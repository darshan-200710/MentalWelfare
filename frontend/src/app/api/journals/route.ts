import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getAIProvider } from "@/lib/ai/provider";
import { triggerRiskFromContent } from "@/lib/risk-engine";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit";
import { jsonError, apiRoute } from "@/lib/api-shared";
import { sanitizeUtf8Text } from "@/lib/sanitize";
import { z } from "zod";
import type { JournalDTO, JournalAnalysis, Mood, WellbeingLevel } from "@/lib/types";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  mood: z.string().nullable().optional(),
  content: z.string().min(1).max(10000),
  status: z.enum(["DRAFT", "SUBMITTED"]).default("SUBMITTED"),
});


function toDTO(j: any): JournalDTO {
  return {
    id: j.id, userId: j.userId, mood: j.mood as Mood | null,
    content: j.content, status: j.status,
    wellbeingLevel: j.wellbeingLevel as WellbeingLevel | null,
    analysis: j.analysisJson ? (JSON.parse(j.analysisJson) as JournalAnalysis) : null,
    createdAt: j.createdAt.toISOString(), updatedAt: j.updatedAt.toISOString(),
  };
}

async function _GET() {
  const { user } = await requireAuth();
  const journals = await db.dailyJournal.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  await logAudit({ actorId: user.id, action: AUDIT_ACTIONS.JOURNAL_ACCESS_OWN, targetType: "Journal" });
  return Response.json({ journals: journals.map(toDTO) });
}

async function _POST(req: NextRequest) {
  const { user } = await requireAuth();
  if (user.role !== "USER") return jsonError("Only CRPF personnel can create journal entries.", 403, "USER_ONLY");
  let body: unknown;
  try { body = await req.json(); } catch { return jsonError("Invalid JSON", 400); }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid input", 422);

  const rawContent = parsed.data.content;
  const content = sanitizeUtf8Text(rawContent) || rawContent;
  const { mood, status } = parsed.data;

  let analysis: JournalAnalysis | null = null;
  let wellbeingLevel: WellbeingLevel | null = null;

  // Only analyze submitted entries (drafts are not yet final)
  if (status === "SUBMITTED") {
    try {
      analysis = await getAIProvider().analyzeJournal(content);
      wellbeingLevel = analysis.wellbeing_signal;
    } catch (e) {
      console.error("[journals] analysis failed:", e);
    }
  }

  const j = await db.dailyJournal.create({
    data: {
      userId: user.id,
      mood: mood ?? null,
      content,
      status,
      wellbeingLevel,
      analysisJson: analysis ? JSON.stringify(analysis) : null,
    },
  });

  // Risk engine: feed the journal signal. This may auto-create an alert if elevated+.
  if (analysis && wellbeingLevel && ["ELEVATED", "HIGH", "CRITICAL"].includes(wellbeingLevel)) {
    await triggerRiskFromContent({
      userId: user.id,
      source: "journal",
      level: wellbeingLevel,
      confidence: analysis.confidence,
      signals: analysis.signals,
      reason: `Journal analysis: ${analysis.signals.join(", ")}`,
    });
  }

  await logAudit({ actorId: user.id, action: status === "DRAFT" ? "journal_draft_saved" : "journal_submitted", targetType: "Journal", targetId: j.id });
  return Response.json({ journal: toDTO(j) });
}

export const GET = apiRoute(_GET);
export const POST = apiRoute(_POST);
