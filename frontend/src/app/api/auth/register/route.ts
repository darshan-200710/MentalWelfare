import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, createSession, toSafeUser } from "@/lib/auth";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit";
import { apiRoute, jsonError } from "@/lib/api-shared";
import { z } from "zod";

export const dynamic = "force-dynamic";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1).max(80),
  serviceNumber: z.string().max(40).optional(),
  unit: z.string().max(80).optional(),
  rank: z.string().max(40).optional(),
});

async function _POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { return jsonError("Invalid JSON", 400); }
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid input", 422);

  const { email, password, name, serviceNumber, unit, rank } = parsed.data;
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return jsonError("An account with this email already exists.", 409, "EMAIL_TAKEN");

  const user = await db.user.create({
    data: {
      email, name, serviceNumber: serviceNumber ?? null, unit: unit ?? null, rank: rank ?? null,
      role: "USER",
      passwordHash: hashPassword(password),
      firstLogin: true,
      onboardingComplete: false,
      emailVerified: false,
    },
  });
  await logAudit({ actorId: user.id, action: AUDIT_ACTIONS.LOGIN + "_register", targetType: "User", targetId: user.id });
  await createSession(user.id);
  return Response.json({ user: toSafeUser(user) });
}

async function _GET() {
  const { getCurrentUser } = await import("@/lib/auth");
  const cur = await getCurrentUser();
  if (!cur) return Response.json({ user: null });
  return Response.json({ user: cur.user });
}

export const POST = apiRoute(_POST);
export const GET = apiRoute(_GET);
