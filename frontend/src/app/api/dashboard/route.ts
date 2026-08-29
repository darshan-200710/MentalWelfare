import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit";
import { apiRoute } from "@/lib/api-shared";

export const dynamic = "force-dynamic";

// GET /api/dashboard — current user's own, non-sensitive dashboard summary.
// The hidden internal risk score is NEVER returned here.
async function _GET() {
  const { user } = await requireAuth();

  const [journals, voiceEntries, conversations, assessmentCount, streak] = await Promise.all([
    db.dailyJournal.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 5 }),
    db.voiceEntry.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 5 }),
    db.aIConversation.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, take: 3 }),
    db.assessmentSession.count({ where: { userId: user.id } }),
    computeStreak(user.id),
  ]);

  await logAudit({ actorId: user.id, action: "dashboard_viewed_own", targetType: "User", targetId: user.id });

  return Response.json({
    user,
    streak,
    stats: {
      checkIns: assessmentCount,
      journals: await db.dailyJournal.count({ where: { userId: user.id } }),
      voiceEntries: await db.voiceEntry.count({ where: { userId: user.id } }),
      conversations: await db.aIConversation.count({ where: { userId: user.id } }),
    },
    recent: {
      journals: journals.map((j) => ({
        id: j.id, mood: j.mood, status: j.status,
        createdAt: j.createdAt.toISOString(),
        preview: j.content.slice(0, 140),
      })),
      voiceEntries: voiceEntries.map((v) => ({
        id: v.id, durationSec: v.durationSec,
        transcript: (v.editedTranscript || v.transcript).slice(0, 140),
        createdAt: v.createdAt.toISOString(),
      })),
      conversations: conversations.map((c) => ({
        id: c.id, title: c.title, updatedAt: c.updatedAt.toISOString(),
      })),
    },
    needsOnboarding: !user.onboardingComplete,
  });
}

async function computeStreak(userId: string): Promise<{ current: number; longest: number; lastCheckIn: string | null }> {
  const journals = await db.dailyJournal.findMany({
    where: { userId, status: "SUBMITTED" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (journals.length === 0) return { current: 0, longest: 0, lastCheckIn: null };

  // group by day
  const days = new Set<string>();
  for (const j of journals) {
    const d = new Date(j.createdAt);
    days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  }
  const sorted = Array.from(days).sort((a, b) => (a < b ? 1 : -1));

  // current streak: consecutive days ending today/yesterday
  let current = 0;
  const today = new Date();
  let cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  for (const dayStr of sorted) {
    const [y, m, d] = dayStr.split("-").map(Number);
    const day = new Date(y, m, d);
    const diffDays = Math.round((cursor.getTime() - day.getTime()) / 86400000);
    if (diffDays === 0) { current++; cursor = new Date(day.getTime() - 86400000); }
    else if (diffDays === 1 && current === 0) { cursor = day; current++; cursor = new Date(day.getTime() - 86400000); }
    else break;
  }

  // longest streak (rough, by sorted unique days)
  let longest = 0; let run = 0; let prev: Date | null = null;
  const asc = [...sorted].reverse();
  for (const dayStr of asc) {
    const [y, m, d] = dayStr.split("-").map(Number);
    const day = new Date(y, m, d);
    if (prev) {
      const diff = Math.round((day.getTime() - prev.getTime()) / 86400000);
      run = diff === 1 ? run + 1 : 1;
    } else run = 1;
    longest = Math.max(longest, run);
    prev = day;
  }

  return { current, longest: Math.max(longest, current), lastCheckIn: journals[0].createdAt.toISOString() };
}

export const GET = apiRoute(_GET);
