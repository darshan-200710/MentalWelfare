import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import type { AuditLogDTO } from "@/lib/types";
import { apiRoute } from "@/lib/api-shared";

export const dynamic = "force-dynamic";

async function _GET(req: NextRequest) {
  const { user } = await requirePermission("VIEW_AUDIT_LOGS");
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "40", 10)));

  const where: any = {};
  if (action) where.action = { contains: action };

  const [total, logs] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where, orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize, take: pageSize,
      include: { actor: { select: { name: true, email: true } } },
    }),
  ]);

  const rows: AuditLogDTO[] = logs.map((l) => ({
    id: l.id, actorId: l.actorId, actorName: l.actor?.name ?? l.actor?.email ?? "system",
    action: l.action, targetType: l.targetType, targetId: l.targetId,
    metadata: l.metadataJson ? JSON.parse(l.metadataJson) : null,
    createdAt: l.createdAt.toISOString(),
  }));

  return Response.json({ logs: rows, total, page, pageSize, pages: Math.ceil(total / pageSize) });
}

export const GET = apiRoute(_GET);
