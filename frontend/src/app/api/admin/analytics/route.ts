import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { LEVEL_META } from "@/lib/constants";
import type { WellbeingLevel } from "@/lib/types";
import { apiRoute } from "@/lib/api-shared";

export const dynamic = "force-dynamic";

// GET /api/admin/analytics — charts data (risk distribution + check-in activity + units)
async function _GET() {
  await requirePermission("VIEW_ANALYTICS");

  const users = await db.user.findMany({ where: { role: "USER" }, select: { id: true, unit: true } });

  // Risk distribution
  const levelCounts: Record<WellbeingLevel, number> = { NORMAL: 0, LOW: 0, MODERATE: 0, ELEVATED: 0, HIGH: 0, CRITICAL: 0 };
  const unitMap = new Map<string, { total: number; elevated: number }>();
  for (const u of users) {
    const r = await db.riskEvent.findFirst({ where: { userId: u.id }, orderBy: { createdAt: "desc" } });
    const lvl = (r?.level as WellbeingLevel) ?? "NORMAL";
    levelCounts[lvl] = (levelCounts[lvl] ?? 0) + 1;
    const unit = u.unit ?? "Unassigned";
    const cur = unitMap.get(unit) ?? { total: 0, elevated: 0 };
    cur.total++;
    if (lvl === "ELEVATED" || lvl === "HIGH" || lvl === "CRITICAL") cur.elevated++;
    unitMap.set(unit, cur);
  }

  // Check-in activity (last 14 days) — submitted journals + assessments
  const since = new Date(Date.now() - 14 * 86400000);
  const [journals, assessments, voice, chats] = await Promise.all([
    db.dailyJournal.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    db.assessmentSession.findMany({ where: { startedAt: { gte: since } }, select: { startedAt: true } }),
    db.voiceEntry.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    db.aIMessage.findMany({ where: { createdAt: { gte: since }, role: "user" }, select: { createdAt: true } }),
  ]);

  const activityByDay = (rows: { createdAt?: Date; startedAt?: Date }[]) => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const d = (r.createdAt ?? r.startedAt);
      if (!d) continue;
      const key = d.toISOString().slice(0, 10);
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return m;
  };
  const jm = activityByDay(journals), am = activityByDay(assessments), vm = activityByDay(voice), cm = activityByDay(chats);
  const activity: { date: string; journals: number; assessments: number; voice: number; chats: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    activity.push({ date: d, journals: jm.get(d) ?? 0, assessments: am.get(d) ?? 0, voice: vm.get(d) ?? 0, chats: cm.get(d) ?? 0 });
  }

  return Response.json({
    riskDistribution: Object.entries(levelCounts).map(([lvl, count]) => ({
      level: lvl as WellbeingLevel, label: LEVEL_META[lvl as WellbeingLevel].label, count, color: LEVEL_META[lvl as WellbeingLevel].dot,
    })),
    units: Array.from(unitMap.entries()).map(([unit, v]) => ({ unit, total: v.total, elevated: v.elevated })),
    activity,
  });
}

export const GET = apiRoute(_GET);
