import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { hasPermission } from "@/lib/constants";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit";
import { jsonError, apiRoute } from "@/lib/api-shared";
import type { WellbeingLevel } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/admin/personnel/[id] — person detail. Sensitive sections (journals,
// conversations, assessments) are returned ONLY if the caller has the matching
// permission, and EVERY sensitive read is audit-logged.
async function _GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user } = await requirePermission("VIEW_USER_PROFILE");
  const { id } = await params;
  const target = await db.user.findUnique({ where: { id } });
  if (!target || target.role !== "USER") return jsonError("Personnel record not found.", 404);

  // Profile (operational fields)
  const profile = {
    id: target.id, name: target.name, serviceNumber: target.serviceNumber,
    unit: target.unit, rank: target.rank, role: target.role,
    status: target.status, createdAt: target.createdAt.toISOString(),
    lastLoginAt: target.lastLoginAt?.toISOString() ?? null,
    lastActiveAt: target.lastActiveAt?.toISOString() ?? null,
    onboardingComplete: target.onboardingComplete,
  };

  // Latest risk indicator (requires VIEW_RISK_INDICATOR)
  let latestRisk: { level: WellbeingLevel; score: number; source: string; createdAt: string } | null = null;
  if (hasPermission(user.role, "VIEW_RISK_INDICATOR")) {
    const r = await db.riskEvent.findFirst({ where: { userId: id }, orderBy: { createdAt: "desc" } });
    if (r) latestRisk = { level: r.level as WellbeingLevel, score: r.confidence * 100, source: r.source, createdAt: r.createdAt.toISOString() };
  }

  // Risk trend (last 14 events)
  const riskTrend = hasPermission(user.role, "VIEW_RISK_INDICATOR")
    ? (await db.riskEvent.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 14 }))
        .map((r) => ({ level: r.level as WellbeingLevel, source: r.source, createdAt: r.createdAt.toISOString() }))
    : [];

  // Alerts on this person
  const alerts = (await db.alert.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 20 }))
    .map((a) => ({ id: a.id, severity: a.severity, status: a.status, reason: a.reason, source: a.source, createdAt: a.createdAt.toISOString(), resolvedAt: a.resolvedAt?.toISOString() ?? null }));

  // Support requests
  const support = (await db.supportRequest.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 20 }))
    .map((s) => ({ id: s.id, type: s.type, status: s.status, message: s.message, createdAt: s.createdAt.toISOString() }));

  // Assessment history summary — requires VIEW_ASSESSMENT (clinical)
  let assessments: any[] = [];
  if (hasPermission(user.role, "VIEW_ASSESSMENT")) {
    const sessions = await db.assessmentSession.findMany({ where: { userId: id }, orderBy: { startedAt: "desc" }, take: 20, include: { result: true } });
    assessments = sessions.map((s) => ({
      id: s.id, completedAt: s.completedAt?.toISOString() ?? s.startedAt.toISOString(),
      level: s.result?.wellbeingLevel ?? null,
      normalizedScore: s.result?.normalizedScore ?? null,
    }));
    await logAudit({ actorId: user.id, action: AUDIT_ACTIONS.ASSESSMENT_ACCESS, targetType: "User", targetId: id, metadata: { count: assessments.length } });
  }

  // Journals — requires VIEW_JOURNAL (very sensitive)
  let journals: any[] = [];
  if (hasPermission(user.role, "VIEW_JOURNAL")) {
    const js = await db.dailyJournal.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 30 });
    journals = js.map((j) => ({
      id: j.id, mood: j.mood, content: j.content, status: j.status,
      wellbeingLevel: j.wellbeingLevel, createdAt: j.createdAt.toISOString(),
    }));
    await logAudit({ actorId: user.id, action: AUDIT_ACTIONS.SENSITIVE_ACCESS, targetType: "Journal", targetId: id, metadata: { reason: "VIEW_JOURNAL", count: journals.length } });
  }

  // AI conversations — requires VIEW_AI_CONVERSATION (very sensitive)
  let conversations: any[] = [];
  if (hasPermission(user.role, "VIEW_AI_CONVERSATION")) {
    const convs = await db.aIConversation.findMany({ where: { userId: id }, orderBy: { updatedAt: "desc" }, take: 10, include: { messages: { orderBy: { createdAt: "asc" } } } });
    conversations = convs.map((c) => ({
      id: c.id, title: c.title, createdAt: c.createdAt.toISOString(),
      messages: c.messages.map((m) => ({ role: m.role, content: m.content, riskFlag: m.riskFlag, createdAt: m.createdAt.toISOString() })),
    }));
    await logAudit({ actorId: user.id, action: AUDIT_ACTIONS.SENSITIVE_ACCESS, targetType: "AIConversation", targetId: id, metadata: { reason: "VIEW_AI_CONVERSATION", count: conversations.length } });
  }

  // Voice transcripts — also gated by VIEW_JOURNAL
  let voiceEntries: any[] = [];
  if (hasPermission(user.role, "VIEW_JOURNAL")) {
    const vs = await db.voiceEntry.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 20 });
    voiceEntries = vs.map((v) => ({
      id: v.id, durationSec: v.durationSec, transcript: v.editedTranscript || v.transcript,
      wellbeingLevel: v.wellbeingLevel, createdAt: v.createdAt.toISOString(),
    }));
  }

  await logAudit({ actorId: user.id, action: AUDIT_ACTIONS.USER_PROFILE_ACCESS, targetType: "User", targetId: id });

  return Response.json({
    profile,
    latestRisk,
    riskTrend,
    alerts,
    supportRequests: support,
    assessments,
    journals,
    conversations,
    voiceEntries,
    // explicit flags so the UI knows what it was authorized to see
    visible: {
      risk: hasPermission(user.role, "VIEW_RISK_INDICATOR"),
      assessments: hasPermission(user.role, "VIEW_ASSESSMENT"),
      journals: hasPermission(user.role, "VIEW_JOURNAL"),
      conversations: hasPermission(user.role, "VIEW_AI_CONVERSATION"),
    },
  });
}

export const GET = apiRoute(_GET);
