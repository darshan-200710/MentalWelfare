import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getAIProvider } from "@/lib/ai/provider";
import { jsonError, apiRoute } from "@/lib/api-shared";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({ text: z.string().min(1).max(10000) });

// POST /api/ai/analyze-journal — runs the wellbeing analysis on arbitrary text
// (used by the voice journal review screen and the daily log preview). The
// internal wellbeing_signal is returned only to the OWNER of the text; the UI
// does not display the level to the end user — only a gentle confirmation.
async function _POST(req: NextRequest) {
  const { user } = await requireAuth();
  let body: unknown;
  try { body = await req.json(); } catch { return jsonError("Invalid JSON", 400); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid input", 422);

  const analysis = await getAIProvider().analyzeJournal(parsed.data.text);
  // Owner-facing: confirm analysis ran, hide the raw indicator label.
  return Response.json({
    ok: true,
    signalCount: analysis.signals.length,
    requiresHumanReview: analysis.requires_human_review,
    summary: analysis.summary ?? null,
    // The level is intentionally NOT echoed back to the client here.
    analyzedFor: user.id,
  });
}

export const POST = apiRoute(_POST);
