import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit";
import { jsonError, apiRoute } from "@/lib/api-shared";
import { z } from "zod";

export const dynamic = "force-dynamic";

async function _GET(req: NextRequest) {
  const { user } = await requirePermission("MANAGE_ALERTS");
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const severity = searchParams.get("severity");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)));

  const where: any = {};
  if (status) where.status = status;
  if (severity) where.severity = severity;

  const [total, alerts] = await Promise.all([
    db.alert.count({ where }),
    db.alert.findMany({
      where, orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize, take: pageSize,
      include: { user: { select: { name: true, unit: true, serviceNumber: true } }, assignee: { select: { name: true } } },
    }),
  ]);

  return Response.json({
    alerts: alerts.map((a) => ({
      id: a.id, userId: a.userId, userName: a.user.name ?? "—", userUnit: a.user.unit,
      severity: a.severity, status: a.status, reason: a.reason, source: a.source,
      assignedTo: a.assignee?.name ?? null,
      createdAt: a.createdAt.toISOString(), resolvedAt: a.resolvedAt?.toISOString() ?? null,
    })),
    total, page, pageSize, pages: Math.ceil(total / pageSize),
  });
}

const updateSchema = z.object({
  status: z.enum(["OPEN", "ACKNOWLEDGED", "IN_REVIEW", "RESOLVED"]).optional(),
  assignedToId: z.string().nullable().optional(),
});

async function _PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user } = await requirePermission("MANAGE_ALERTS");
  const { id } = await params;
  let body: unknown;
  try { body = await req.json(); } catch { return jsonError("Invalid JSON", 400); }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid input", 422);

  const data: any = {};
  if (parsed.data.status) data.status = parsed.data.status;
  if (parsed.data.assignedToId !== undefined) data.assignedToId = parsed.data.assignedToId;
  if (parsed.data.status === "RESOLVED") data.resolvedAt = new Date();

  const a = await db.alert.update({ where: { id }, data });
  await logAudit({ actorId: user.id, action: AUDIT_ACTIONS.ALERT_UPDATED, targetType: "Alert", targetId: a.id, metadata: { status: a.status, assignedToId: a.assignedToId } });
  return Response.json({ ok: true });
}

export const GET = apiRoute(_GET);
export const PUT = apiRoute(_PUT);
