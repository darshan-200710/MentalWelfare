import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit";
import type { PersonnelRowDTO, Role, UserStatus, WellbeingLevel } from "@/lib/types";
import { apiRoute } from "@/lib/api-shared";

export const dynamic = "force-dynamic";

// GET /api/admin/personnel — searchable, filterable, paginated list.
// Only operational, non-clinical fields are returned here.
async function _GET(req: NextRequest) {
  const { user } = await requirePermission("VIEW_USER_PROFILE");
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() || "";
  const unit = searchParams.get("unit") || "";
  const level = searchParams.get("level") || "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") || "12", 10)));

  const where: any = { role: "USER", NOT: { id: user.id } };
  if (q) where.OR = [
    { name: { contains: q } },
    { serviceNumber: { contains: q } },
    { email: { contains: q } },
  ];
  if (unit) where.unit = unit;

  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where, orderBy: { lastActiveAt: "desc" },
      skip: (page - 1) * pageSize, take: pageSize,
    }),
  ]);

  // attach latest risk level + last check-in per user
  const rows: PersonnelRowDTO[] = [];
  for (const u of users) {
    const [risk, lastJournal, lastAssessment] = await Promise.all([
      db.riskEvent.findFirst({ where: { userId: u.id }, orderBy: { createdAt: "desc" } }),
      db.dailyJournal.findFirst({ where: { userId: u.id }, orderBy: { createdAt: "desc" } }),
      db.assessmentSession.findFirst({ where: { userId: u.id }, orderBy: { startedAt: "desc" } }),
    ]);
    // filter by level if requested (post-fetch; small N)
    if (level && (risk?.level ?? "NORMAL") !== level) continue;
    rows.push({
      id: u.id, name: u.name, serviceNumber: u.serviceNumber, unit: u.unit,
      role: u.role as Role, status: u.status as UserStatus,
      wellbeingLevel: (risk?.level as WellbeingLevel) ?? "NORMAL",
      lastCheckIn: lastJournal?.createdAt.toISOString() ?? lastAssessment?.startedAt.toISOString() ?? null,
      lastActivity: u.lastActiveAt?.toISOString() ?? null,
    });
  }

  await logAudit({ actorId: user.id, action: AUDIT_ACTIONS.ADMIN_VIEW_PERSONNEL, targetType: "User" });

  const allUnitUsers = await db.user.findMany({ where: { role: "USER", NOT: { unit: null } }, select: { unit: true } });
  const unitSet = new Set<string>();
  for (const u of allUnitUsers) if (u.unit) unitSet.add(u.unit);
  return Response.json({
    rows,
    total,
    page,
    pageSize,
    pages: Math.ceil(total / pageSize),
    units: Array.from(unitSet),
  });
}

export const GET = apiRoute(_GET);
