import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { apiRoute } from "@/lib/api-shared";

export const dynamic = "force-dynamic";

// alias GET /api/admin/alerts -> list (separate from [id] PUT)
async function _GET() {
  await requirePermission("MANAGE_ALERTS");
  const alerts = await db.alert.findMany({
    orderBy: { createdAt: "desc" }, take: 100,
    include: { user: { select: { name: true, unit: true, serviceNumber: true } }, assignee: { select: { name: true } } },
  });
  return Response.json({
    alerts: alerts.map((a) => ({
      id: a.id, userId: a.userId, userName: a.user.name ?? "—", userUnit: a.user.unit,
      severity: a.severity, status: a.status, reason: a.reason, source: a.source,
      assignedTo: a.assignee?.name ?? null,
      createdAt: a.createdAt.toISOString(), resolvedAt: a.resolvedAt?.toISOString() ?? null,
    })),
  });
}

export const GET = apiRoute(_GET);
