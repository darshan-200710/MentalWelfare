import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { LEVEL_META } from "@/lib/constants";
import type { WellbeingLevel } from "@/lib/types";
import { apiRoute } from "@/lib/api-shared";

export const dynamic = "force-dynamic";

// GET /api/admin/risk — risk distribution + trend + recent alerts (operational view).
async function _GET(req: NextRequest) {
  const { user } = await requirePermission("VIEW_RISK_INDICATOR");
  const { searchParams } = new URL(req.url);
  const unit = searchParams.get("unit");
  const level = searchParams.get("level");
  const days = Math.min(90, Math.max(1, parseInt(searchParams.get("days") || "30", 10)));

  // Filter users by unit if requested
  const userWhere: any = { role: "USER" };
  if (unit) userWhere.unit = unit;
  const users = await db.user.findMany({ where: userWhere, select: { id: true } });
  const userIds = users.map((u) => u.id);

  // Latest risk per user (within filtered set)
  const levelCounts: Record<WellbeingLevel, number> = { NORMAL: 0, LOW: 0, MODERATE: 0, ELEVATED: 0, HIGH: 0, CRITICAL: 0 };
  for (const u of users) {
    const r = await db.riskEvent.findFirst({ where: { userId: u.id }, orderBy: { createdAt: "desc" } });
    const lvl = (r?.level as WellbeingLevel) ?? "NORMAL";
    if (level && lvl !== level) continue;
    levelCounts[lvl] = (levelCounts[lvl] ?? 0) + 1;
  }

  // Trend: alerts created per day over the window
  const since = new Date(Date.now() - days * 86400000);
  const alerts = await db.alert.findMany({
    where: { userId: { in: userIds }, createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
  });
  const trend: { date: string; count: number }[] = [];
  const byDay = new Map<string, number>();
  for (const a of alerts) {
    const d = a.createdAt.toISOString().slice(0, 10);
    byDay.set(d, (byDay.get(d) ?? 0) + 1);
  }
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    trend.push({ date: d, count: byDay.get(d) ?? 0 });
  }

  // Recent alerts
  const recent = (await db.alert.findMany({
    where: { userId: { in: userIds } },
    orderBy: { createdAt: "desc" }, take: 12,
    include: { user: { select: { name: true, unit: true, serviceNumber: true } } },
  })).map((a) => ({
    id: a.id, userId: a.userId, userName: a.user.name ?? "—", userUnit: a.user.unit,
    severity: a.severity, status: a.status, reason: a.reason, source: a.source,
    createdAt: a.createdAt.toISOString(), resolvedAt: a.resolvedAt?.toISOString() ?? null,
  }));

  return Response.json({
    distribution: Object.entries(levelCounts).map(([lvl, count]) => ({
      level: lvl as WellbeingLevel, label: LEVEL_META[lvl as WellbeingLevel].label, count, color: LEVEL_META[lvl as WellbeingLevel].dot,
    })),
    trend,
    recentAlerts: recent,
  });
}

export const GET = apiRoute(_GET);
