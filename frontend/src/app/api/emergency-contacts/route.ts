import { db } from "@/lib/db";
import { apiRoute } from "@/lib/api-shared";

export const dynamic = "force-dynamic";

async function _GET() {
  const rows = await db.emergencyContact.findMany({
    where: { active: true },
    orderBy: { order: "asc" },
  });
  return Response.json({
    contacts: rows.map((c) => ({
      id: c.id, label: c.label, description: c.description,
      contact: c.contact, availableHours: c.availableHours,
    })),
  });
}

export const GET = apiRoute(_GET);
