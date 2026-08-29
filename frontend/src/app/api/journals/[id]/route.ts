import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/constants";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit";
import { jsonError, apiRoute } from "@/lib/api-shared";
import { z } from "zod";
import type { JournalDTO, JournalAnalysis, Mood, WellbeingLevel } from "@/lib/types";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  mood: z.enum(["great", "good", "okay", "low", "rough"]).nullable().optional(),
  content: z.string().min(1).max(10000).optional(),
  status: z.enum(["DRAFT", "SUBMITTED"]).optional(),
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

async function resolveJournal(id: string, actorId: string, actorRole: string) {
  const j = await db.dailyJournal.findUnique({ where: { id } });
  if (!j) return { error: jsonError("Journal entry not found.", 404) };
  // Owner can always access their own. Otherwise require VIEW_JOURNAL permission
  // AND record a sensitive-access audit entry.
  if (j.userId !== actorId) {
    if (!hasPermission(actorRole as any, "VIEW_JOURNAL")) {
      return { error: jsonError("You do not have permission to access this journal.", 403) };
    }
  }
  return { j };
}

async function _GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireAuth();
  const { id } = await params;
  const res = await resolveJournal(id, user.id, user.role);
  if ("error" in res && res.error) return res.error;
  const isOwn = res.j.userId === user.id;
  await logAudit({
    actorId: user.id,
    action: isOwn ? AUDIT_ACTIONS.JOURNAL_ACCESS_OWN : AUDIT_ACTIONS.SENSITIVE_ACCESS,
    targetType: "Journal",
    targetId: res.j.id,
    metadata: isOwn ? null : { reason: "VIEW_JOURNAL", ownerId: res.j.userId },
  });
  return Response.json({ journal: toDTO(res.j) });
}

async function _PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireAuth();
  const { id } = await params;
  const res = await resolveJournal(id, user.id, user.role);
  if ("error" in res && res.error) return res.error;
  if (res.j.userId !== user.id) return jsonError("You can only edit your own journal entries.", 403);

  let body: unknown;
  try { body = await req.json(); } catch { return jsonError("Invalid JSON", 400); }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid input", 422);

  const data: any = {};
  if (parsed.data.mood !== undefined) data.mood = parsed.data.mood;
  if (parsed.data.content !== undefined) data.content = parsed.data.content;
  if (parsed.data.status !== undefined) data.status = parsed.data.status;

  // Re-run analysis if transitioning to SUBMITTED with new content
  if ((parsed.data.status === "SUBMITTED" || res.j.status === "SUBMITTED") && (parsed.data.content || parsed.data.status)) {
    const { getAIProvider } = await import("@/lib/ai/provider");
    try {
      const analysis = await getAIProvider().analyzeJournal(data.content ?? res.j.content);
      data.analysisJson = JSON.stringify(analysis);
      data.wellbeingLevel = analysis.wellbeing_signal;
      const { triggerRiskFromContent } = await import("@/lib/risk-engine");
      if (["ELEVATED", "HIGH", "CRITICAL"].includes(analysis.wellbeing_signal)) {
        await triggerRiskFromContent({
          userId: user.id, source: "journal", level: analysis.wellbeing_signal,
          confidence: analysis.confidence, signals: analysis.signals,
          reason: `Journal analysis (edit): ${analysis.signals.join(", ")}`,
        });
      }
    } catch (e) { console.error("[journals] re-analysis failed:", e); }
  }

  const updated = await db.dailyJournal.update({ where: { id }, data });
  await logAudit({ actorId: user.id, action: "journal_updated", targetType: "Journal", targetId: id });
  return Response.json({ journal: toDTO(updated) });
}

async function _DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireAuth();
  const { id } = await params;
  const res = await resolveJournal(id, user.id, user.role);
  if ("error" in res && res.error) return res.error;
  if (res.j.userId !== user.id) return jsonError("You can only delete your own journal entries.", 403);
  await db.dailyJournal.delete({ where: { id } });
  await logAudit({ actorId: user.id, action: "journal_deleted", targetType: "Journal", targetId: id });
  return Response.json({ ok: true });
}

export const GET = apiRoute(_GET);
export const PUT = apiRoute(_PUT);
export const DELETE = apiRoute(_DELETE);
