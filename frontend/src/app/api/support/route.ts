import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { jsonError, apiRoute } from "@/lib/api-shared";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  type: z.enum(["general", "counselling", "urgent", "peer"]),
  message: z.string().min(1).max(2000),
});

async function _GET() {
  const { user } = await requireAuth();
  const reqs = await db.supportRequest.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return Response.json({
    requests: reqs.map((r) => ({
      id: r.id, type: r.type, message: r.message, status: r.status,
      createdAt: r.createdAt.toISOString(), resolvedAt: r.resolvedAt?.toISOString() ?? null,
    })),
  });
}

async function _POST(req: NextRequest) {
  const { user } = await requireAuth();
  let body: unknown;
  try { body = await req.json(); } catch { return jsonError("Invalid JSON", 400); }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid input", 422);

  const r = await db.supportRequest.create({
    data: { userId: user.id, type: parsed.data.type, message: parsed.data.message, status: "OPEN" },
  });
  await logAudit({ actorId: user.id, action: "support_request_created", targetType: "SupportRequest", targetId: r.id });
  return Response.json({ ok: true, id: r.id });
}

export const GET = apiRoute(_GET);
export const POST = apiRoute(_POST);
