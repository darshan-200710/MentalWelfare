import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, createSession, recordFailedLogin, clearFailedLogin, isLocked, toSafeUser } from "@/lib/auth";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit";
import { jsonError, apiRoute } from "@/lib/api-shared";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

async function _POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { return jsonError("Invalid JSON", 400); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid email or password.", 422);

  const { email, password } = parsed.data;
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    await logAudit({ actorId: null, action: AUDIT_ACTIONS.FAILED_LOGIN, targetType: "User", targetId: email });
    return jsonError("Invalid email or password.", 401, "INVALID_CREDENTIALS");
  }
  if (isLocked(user)) return jsonError("Account temporarily locked after repeated failed attempts. Please try again later.", 423, "LOCKED");

  if (!verifyPassword(password, user.passwordHash)) {
    await recordFailedLogin(email);
    await logAudit({ actorId: user.id, action: AUDIT_ACTIONS.FAILED_LOGIN, targetType: "User", targetId: user.id });
    return jsonError("Invalid email or password.", 401, "INVALID_CREDENTIALS");
  }

  await clearFailedLogin(user.id);
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), status: "ACTIVE" } });
  await createSession(user.id);
  await logAudit({ actorId: user.id, action: AUDIT_ACTIONS.LOGIN, targetType: "User", targetId: user.id });
  return Response.json({ user: toSafeUser(user) });
}

export const POST = apiRoute(_POST);
