import { db } from "@/lib/db";
import { apiRoute } from "@/lib/api-shared";

export const dynamic = "force-dynamic";

// GET /api/resources — public-ish catalog (also used by authed users).
async function _GET() {
  const rows = await db.resource.findMany({
    where: { active: true },
    orderBy: [{ category: "asc" }, { order: "asc" }],
  });
  return Response.json({
    resources: rows.map((r) => ({
      id: r.id, title: r.title, summary: r.summary, category: r.category,
      body: r.body, source: r.source, durationMin: r.durationMin,
      tags: r.tags ? JSON.parse(r.tags) : [],
    })),
  });
}

export const GET = apiRoute(_GET);
