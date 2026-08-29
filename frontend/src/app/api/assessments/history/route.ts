import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit";
import { hasPermission } from "@/lib/constants";
import { apiRoute } from "@/lib/api-shared";

export const dynamic = "force-dynamic";

// Returns the current user's own assessment *history summary* (no raw scores
// surfaced beyond what's permitted). Authorized roles may see levels.
async function _GET() {
  const { user } = await requireAuth();
  const sessions = await db.assessmentSession.findMany({
    where: { userId: user.id },
    orderBy: { startedAt: "desc" },
    take: 20,
    include: { result: true },
  });

  await logAudit({ actorId: user.id, action: "assessment_history_viewed_own", targetType: "AssessmentSession" });

  // The user sees only that a check-in was recorded, plus a gentle category hint — never the score.
  return Response.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      completedAt: s.completedAt?.toISOString() ?? s.startedAt.toISOString(),
      // The end-user message stays deliberately vague; levels are reserved for
      // authorized viewers in /api/admin/personnel/[id].
      recorded: true,
    })),
  });
}

export const GET = apiRoute(_GET);
