import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit";
import { jsonError, apiRoute } from "@/lib/api-shared";
import { CONSENT_VERSION } from "@/lib/constants";
import { z } from "zod";

export const dynamic = "force-dynamic";

const grantSchema = z.object({
  purpose: z.enum(["assessment", "journal_processing", "voice_processing", "ai_processing"]),
  status: z.enum(["GRANTED", "WITHDRAWN"]),
});

async function _GET() {
  const { user } = await requireAuth();
  const records = await db.consentRecord.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return Response.json({
    version: CONSENT_VERSION,
    records: records.map((r) => ({
      purpose: r.purpose, version: r.version, status: r.status,
      grantedAt: r.createdAt.toISOString(),
    })),
  });
}

async function _POST(req: NextRequest) {
  const { user } = await requireAuth();
  let body: unknown;
  try { body = await req.json(); } catch { return jsonError("Invalid JSON", 400); }
  const parsed = grantSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid input", 422);

  const r = await db.consentRecord.create({
    data: {
      userId: user.id, purpose: parsed.data.purpose,
      version: CONSENT_VERSION, status: parsed.data.status,
    },
  });
  await logAudit({
    actorId: user.id,
    action: parsed.data.status === "GRANTED" ? AUDIT_ACTIONS.CONSENT_GRANTED : "consent_withdrawn",
    targetType: "ConsentRecord", targetId: r.id,
    metadata: { purpose: parsed.data.purpose, version: CONSENT_VERSION },
  });
  return Response.json({ ok: true });
}

export const GET = apiRoute(_GET);
export const POST = apiRoute(_POST);
