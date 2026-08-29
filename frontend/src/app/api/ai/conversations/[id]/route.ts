import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { jsonError, apiRoute } from "@/lib/api-shared";
import { decryptChatContent } from "@/lib/crypto";

export const dynamic = "force-dynamic";

// GET /api/ai/conversations/[id] — load full conversation message history
async function _GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user } = await requireAuth();
  const { id } = await ctx.params;

  const conv = await db.aIConversation.findFirst({
    where: { id, userId: user.id },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        take: 100,
      },
    },
  });

  if (!conv) {
    return jsonError("Conversation not found", 404, "NOT_FOUND");
  }

  return Response.json({
    conversation: {
      id: conv.id,
      title: conv.title,
      createdAt: conv.createdAt.toISOString(),
      updatedAt: conv.updatedAt.toISOString(),
    },
    messages: conv.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: decryptChatContent(m.content, user.id),
      riskFlag: m.riskFlag,
      createdAt: m.createdAt.toISOString(),
    })),
  });
}


// DELETE /api/ai/conversations/[id] — delete conversation
async function _DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user } = await requireAuth();
  const { id } = await ctx.params;

  const conv = await db.aIConversation.findFirst({
    where: { id, userId: user.id },
  });

  if (!conv) {
    return jsonError("Conversation not found", 404, "NOT_FOUND");
  }

  await db.aIMessage.deleteMany({ where: { conversationId: id } });
  await db.aIConversation.delete({ where: { id } });

  return Response.json({ ok: true });
}

export const GET = apiRoute(_GET);
export const DELETE = apiRoute(_DELETE);
