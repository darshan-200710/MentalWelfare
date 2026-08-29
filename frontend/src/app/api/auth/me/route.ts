import { getCurrentUser } from "@/lib/auth";
import { apiRoute } from "@/lib/api-shared";

export const dynamic = "force-dynamic";

async function _GET() {
  const cur = await getCurrentUser();
  if (!cur) return Response.json({ user: null });
  return Response.json({ user: cur.user });
}

export const GET = apiRoute(_GET);
