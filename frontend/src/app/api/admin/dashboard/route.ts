import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { LEVEL_META } from "@/lib/constants";
import type { WellbeingLevel } from "@/lib/types";
import { apiRoute } from "@/lib/api-shared";

export const dynamic = "force-dynamic";

// GET /api/admin/dashboard — high-level cards for authorized admins/professionals.
async function _GET() {
  await requirePermission("VIEW_ANALYTICS");

  const [totalUsers, activeUsers, assessments, alertsOpen, criticalAlerts] = await Promise.all([
    db.user.count({ where: { role: "USER" } }),
    db.user.count({ where: { role: "USER", lastActiveAt: { gte: new Date(Date.now() - 7 * 86400000) } } }),
    db.assessmentSession.count(),
    db.alert.count({ where: { status: { in: ["OPEN", "ACKNOWLEDGED", "IN_REVIEW"] } } }),
    db.alert.count({ where: { severity: "CRITICAL", status: { in: ["OPEN", "ACKNOWLEDGED", "IN_REVIEW"] } } }),
  ]);

  // Latest risk level per user (operational indicator)
  const users = await db.user.findMany({ where: { role: "USER" }, select: { id: true } });
  const levelCounts: Record<WellbeingLevel, number> = {
    NORMAL: 0, LOW: 0, MODERATE: 0, ELEVATED: 0, HIGH: 0, CRITICAL: 0,
  };
  let elevated = 0, high = 0;
  for (const u of users) {
    const latest = await db.riskEvent.findFirst({
      where: { userId: u.id }, orderBy: { createdAt: "desc" },
    });
    if (latest) {
      const lvl = latest.level as WellbeingLevel;
      levelCounts[lvl] = (levelCounts[lvl] ?? 0) + 1;
      if (lvl === "ELEVATED") elevated++;
      if (lvl === "HIGH" || lvl === "CRITICAL") high++;
    } else {
      levelCounts.NORMAL++;
    }
  }

  return Response.json({
    cards: {
      totalPersonnel: totalUsers,
      activeUsers,
      assessmentsCompleted: assessments,
      elevatedIndicators: elevated,
      highIndicators: high,
      criticalAlerts,
    },
    riskDistribution: Object.entries(levelCounts).map(([level, count]) => ({
      level: level as WellbeingLevel, label: LEVEL_META[level as WellbeingLevel].label, count, color: LEVEL_META[level as WellbeingLevel].dot,
    })),
  });
}

export const GET = apiRoute(_GET);
