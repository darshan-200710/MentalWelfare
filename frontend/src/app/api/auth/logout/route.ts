import { NextRequest } from "next/server";
import { getCurrentUser, destroySession } from "@/lib/auth";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit";
import { apiRoute } from "@/lib/api-shared";

export const dynamic = "force-dynamic";

async function _POST(_req: NextRequest) {
  const cur = await getCurrentUser();
  if (cur) {
    await logAudit({ actorId: cur.user.id, action: AUDIT_ACTIONS.LOGOUT, targetType: "User", targetId: cur.user.id });
  }
  // read cookie to destroy the session row
  const { cookies } = await import("next/headers");
  const token = (await cookies()).get("sw_session")?.value;
  if (token) await destroySession(token);
  return Response.json({ ok: true });
}

export const POST = apiRoute(_POST);
