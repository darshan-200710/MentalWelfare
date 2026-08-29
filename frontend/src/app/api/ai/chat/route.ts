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


  // Get or create conversation
  let conv = conversationId
    ? await db.aIConversation.findFirst({ where: { id: conversationId, userId: user.id }, include: { messages: { orderBy: { createdAt: "asc" }, take: 20 } } })
    : null;
  if (!conv) {
    conv = await db.aIConversation.create({
      data: { userId: user.id, title: message.slice(0, 60) },
      include: { messages: true },
    });
  }

  // Persist the user's message (encrypted at rest using scrypt AES-256-GCM)

  const userMsg = await db.aIMessage.create({
    data: { conversationId: conv.id, role: "user", content: encryptChatContent(message, user.id) },
  });

  // Build history for the provider with decrypted content.
  const history: ChatTurn[] = conv.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as "user" | "assistant", content: decryptChatContent(m.content, user.id) }));
  history.push({ role: "user", content: message });

  const result = await getAIProvider().chat(history);

  // Persist assistant message (encrypted at rest using scrypt AES-256-GCM)
  const aiMsg = await db.aIMessage.create({
    data: {
      conversationId: conv.id, role: "assistant", content: encryptChatContent(result.content, user.id),
      riskFlag: result.riskFlag,
      metadataJson: result.safetyMessage ? JSON.stringify({ safety: result.safetyMessage }) : null,
    },
  });


  // If the safety layer fired, escalate to the risk engine + alert.
  if (result.riskFlag) {
    await triggerRiskFromContent({
      userId: user.id, source: "ai_chat", level: "HIGH",
      confidence: 0.9, signals: ["high_risk_language"],
      reason: "AI safety layer detected potential high-risk language in chat",
    });
    await logAudit({
      actorId: user.id, action: AUDIT_ACTIONS.AI_SAFETY_TRIGGERED,
      targetType: "AIMessage", targetId: aiMsg.id,
      metadata: { conversationId: conv.id },
    });
  }

  await logAudit({
    actorId: user.id, action: AUDIT_ACTIONS.AI_CHAT,
    targetType: "AIMessage", targetId: aiMsg.id,
    metadata: { conversationId: conv.id, riskFlag: result.riskFlag },
  });

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
