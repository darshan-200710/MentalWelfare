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
  const [convResult, latestAssessment, recentJournals] = await Promise.all([
    // Get or look up existing conversation (last 10 messages only — enough for context)
    conversationId
      ? db.aIConversation.findFirst({
          where: { id: conversationId, userId: user.id },
          include: { messages: { orderBy: { createdAt: "asc" }, take: 10 } },
        })
      : Promise.resolve(null),

    // Latest assessment result for this user
    db.assessmentResult.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        answers: { include: { question: true } },
      },
    }).catch(() => null),

    // Last 3 journal entries
    db.dailyJournal.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { mood: true, status: true, createdAt: true },
    }).catch(() => []),
  ]);

  // Create conversation if none exists
  let conv = convResult;
  if (!conv) {
    conv = await db.aIConversation.create({
      data: { userId: user.id, title: message.slice(0, 60) },
      include: { messages: true },
    });
  }

  // ── Build rich system context string ─────────────────────────────────────
  const lines: string[] = [
    `User ID: ${user.id}`,
    `Name: ${user.name ?? "Unknown"}`,
  ];
  if (user.rank) lines.push(`Rank: ${user.rank}`);
  if (user.unit) lines.push(`Unit: ${user.unit}`);
  if (user.serviceNumber) lines.push(`Service Number: ${user.serviceNumber}`);

  if (latestAssessment) {
    lines.push(`Latest Wellbeing Assessment Level: ${latestAssessment.level}`);
    lines.push(`Assessment Score: ${latestAssessment.normalizedScore}/100`);
    // Add individual domain scores
    for (const answer of latestAssessment.answers) {
      lines.push(`  - ${answer.question.text}: ${answer.value} (score ${answer.score})`);
    }
  }

  if (recentJournals.length > 0) {
    const moodSummary = recentJournals
      .map((j) => `${j.mood ?? "unknown"} (${new Date(j.createdAt).toLocaleDateString()})`)
      .join(", ");
    lines.push(`Recent journal moods: ${moodSummary}`);
  }

  const priorRiskFlags = conv.messages.filter((m) => m.riskFlag).length;
  if (priorRiskFlags > 0) {
    lines.push(`Note: ${priorRiskFlags} prior message(s) in this conversation flagged as high-risk.`);
  }

  lines.push(`Active conversation turn: ${conv.messages.length + 1}`);

  const systemContext = lines.join("\n");

  // ── Persist user message ──────────────────────────────────────────────────
  const userMsg = await db.aIMessage.create({
    data: { conversationId: conv.id, role: "user", content: encryptChatContent(message, user.id) },
  });

  // ── Build history (decrypt only what we have, bounded to 10) ─────────────
  const history: ChatTurn[] = conv.messages
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
