import { runSeed } from "@/lib/seed";
import { apiRoute } from "@/lib/api-shared";

export const dynamic = "force-dynamic";

// POST /api/seed — development-only. Idempotent: skips if users exist unless
// ?force=1 is passed. Never exposed in production deployments (guard via env).
async function _POST(req: Request) {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_SEED !== "1") {
    return Response.json({ error: "Seeding disabled in production." }, { status: 403 });
  }
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";
  const result = await runSeed(force);
  return Response.json(result);
}

export const POST = apiRoute(_POST);
