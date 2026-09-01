import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getAIProvider, type ChatTurn } from "@/lib/ai/provider";
import { triggerRiskFromContent } from "@/lib/risk-engine";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit";
import { jsonError, apiRoute } from "@/lib/api-shared";
import { encryptChatContent, decryptChatContent } from "@/lib/crypto";
import { sanitizeUtf8Text } from "@/lib/sanitize";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  message: z.string().min(1).max(4000),
  conversationId: z.string().nullish(),
});

// POST /api/ai/chat — AI companion. The user's message is treated as UNTRUSTED
// input. A deterministic safety layer decides escalation; the LLM is only called
// when it's safe to continue a normal supportive conversation.
async function _POST(req: NextRequest) {
  const { user } = await requireAuth();
  if (user.role !== "USER") return jsonError("AI companion chat is available to CRPF personnel only.", 403, "USER_ONLY");
  let body: unknown;
  try { body = await req.json(); } catch { return jsonError("Invalid JSON", 400); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid input", 422);

  const rawMessage = parsed.data.message;
  const message = sanitizeUtf8Text(rawMessage) || rawMessage;
  const conversationId = parsed.data.conversationId;

  // ── Fetch conversation + context data in parallel ──────────────────────────
  const [convResult, latestAssessment, recentJournals, latestVoiceEntry] = await Promise.all([
    // Get or look up existing conversation (last 10 messages only — enough for context)
    conversationId
      ? db.aIConversation.findFirst({
          where: { id: conversationId, userId: user.id },
          include: { messages: { orderBy: { createdAt: "desc" }, take: 10 } },
        })
      : Promise.resolve(null),

    // Latest assessment result for this user
    db.assessmentResult.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        session: { include: { answers: { orderBy: { createdAt: "asc" } } } },
      },
    }).catch(() => null),

    // Last 3 journal entries
    db.dailyJournal.findMany({
      where: { userId: user.id, status: "SUBMITTED" },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        mood: true, content: true, wellbeingLevel: true,
        analysisJson: true, createdAt: true,
      },
    }).catch(() => []),

    // Most recent voice reflection, when available
    db.voiceEntry.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        transcript: true, editedTranscript: true,
        wellbeingLevel: true, createdAt: true,
      },
    }).catch(() => null),
  ]);

  // Create conversation if none exists
  let conv = convResult;
  if (!conv) {
    conv = await db.aIConversation.create({
      data: { userId: user.id, title: message.slice(0, 60) },
      include: { messages: true },
    });
  }

  const conversationMessages = [...conv.messages].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
  const compact = (value: string, maxLength = 320) =>
    value.replace(/\s+/g, " ").trim().slice(0, maxLength);
  const parseSignals = (value: string | null): string[] => {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value) as { signals?: unknown };
      return Array.isArray(parsed.signals)
        ? parsed.signals.filter((signal): signal is string => typeof signal === "string").slice(0, 5)
        : [];
    } catch {
      return [];
    }
  };

  // Structured, bounded context for personalization. Deliberately exclude email,
  // database IDs, service number, raw scores, drafts, and full journal history.
  const personalizationContext = {
    context_version: 1,
    profile: {
      preferred_name: user.name?.trim().split(/\s+/)[0] || null,
      rank: user.rank || null,
      unit: user.unit || null,
    },
    latest_check_in: latestAssessment ? {
      completed_at: latestAssessment.createdAt.toISOString(),
      wellbeing_level: latestAssessment.wellbeingLevel,
      signals: (() => {
        try {
          const parsed = JSON.parse(latestAssessment.signalsJson) as unknown;
          return Array.isArray(parsed)
            ? parsed.filter((signal): signal is string => typeof signal === "string").slice(0, 5)
            : [];
        } catch {
          return [];
        }
      })(),
      answers: latestAssessment.session.answers.slice(0, 8).map((answer) => ({
        topic: answer.questionCode,
        response: answer.value,
      })),
    } : null,
    recent_journals: recentJournals.map((journal) => ({
      recorded_at: journal.createdAt.toISOString(),
      mood: journal.mood,
      wellbeing_level: journal.wellbeingLevel,
      signals: parseSignals(journal.analysisJson),
      reflection_excerpt: compact(journal.content),
    })),
    latest_voice_reflection: latestVoiceEntry ? {
      recorded_at: latestVoiceEntry.createdAt.toISOString(),
      wellbeing_level: latestVoiceEntry.wellbeingLevel,
      reflection_excerpt: compact(
        latestVoiceEntry.editedTranscript || latestVoiceEntry.transcript,
      ),
    } : null,
    conversation: {
      turn_number: conversationMessages.length + 1,
    },
  };

  const systemContext = JSON.stringify(personalizationContext);

  // ── Persist user message ──────────────────────────────────────────────────
  const userMsg = await db.aIMessage.create({
    data: { conversationId: conv.id, role: "user", content: encryptChatContent(message, user.id) },
  });

  // ── Build history (decrypt only what we have, bounded to 10) ─────────────
  const history: ChatTurn[] = conversationMessages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as "user" | "assistant", content: decryptChatContent(m.content, user.id) }));
  history.push({ role: "user", content: message });

  // ── Call AI provider with enriched context ────────────────────────────────
  const result = await getAIProvider().chat(history, systemContext);

  // ── Persist assistant message ─────────────────────────────────────────────
  const aiMsg = await db.aIMessage.create({
    data: {
      conversationId: conv.id, role: "assistant", content: encryptChatContent(result.content, user.id),
      riskFlag: result.riskFlag,
      metadataJson: result.safetyMessage ? JSON.stringify({ safety: result.safetyMessage }) : null,
    },
  });

  // ── Fire-and-forget audit + risk (don't await both, use Promise.all) ──────
  const sideEffects: Promise<unknown>[] = [
    logAudit({
      actorId: user.id, action: AUDIT_ACTIONS.AI_CHAT,
      targetType: "AIMessage", targetId: aiMsg.id,
      metadata: { conversationId: conv.id, riskFlag: result.riskFlag },
    }),
  ];

  if (result.riskFlag) {
    sideEffects.push(
      triggerRiskFromContent({
        userId: user.id, source: "ai_chat", level: "HIGH",
        confidence: 0.9, signals: ["high_risk_language"],
        reason: "AI safety layer detected potential high-risk language in chat",
      }),
      logAudit({
        actorId: user.id, action: AUDIT_ACTIONS.AI_SAFETY_TRIGGERED,
        targetType: "AIMessage", targetId: aiMsg.id,
        metadata: { conversationId: conv.id },
      }),
    );
  }

  // Run all side effects in parallel — don't block response on them
  void Promise.all(sideEffects).catch((e) => console.error("[chat] side effect error:", e));

  return Response.json({
    conversationId: conv.id,
    message: {
      id: aiMsg.id,
      role: "assistant",
      content: result.content,
      moraleScore: result.moraleScore,
      mood: result.mood,
      ragSource: result.ragSource,
      riskFlag: result.riskFlag,
      createdAt: aiMsg.createdAt.toISOString(),
    },
    userMessageId: userMsg.id,
    riskFlag: result.riskFlag,
    safetyMessage: result.riskFlag ? result.safetyMessage : null,
  });
}

export const POST = apiRoute(_POST);
