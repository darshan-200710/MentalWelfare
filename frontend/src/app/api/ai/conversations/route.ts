import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { apiRoute } from "@/lib/api-shared";

export const dynamic = "force-dynamic";

// GET /api/ai/conversations — current user's own conversation history (titles only)
async function _GET() {
  const { user } = await requireAuth();
  const convs = await db.aIConversation.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });
  return Response.json({
    conversations: convs.map((c) => ({
      id: c.id, title: c.title, createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString(),
    })),
  });
}

export const GET = apiRoute(_GET);
