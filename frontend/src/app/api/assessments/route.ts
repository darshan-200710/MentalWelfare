import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getAIProvider } from "@/lib/ai/provider";
import { triggerRiskFromContent } from "@/lib/risk-engine";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit";
import { jsonError, apiRoute } from "@/lib/api-shared";
import { z } from "zod";

export const dynamic = "force-dynamic";

const DEFAULT_QUESTIONS = [
  {
    code: "PRESSURE_MGMT",
    questionText: "Over the past week, how manageable has your day-to-day operational pressure felt?",
    questionType: "single_choice",
    options: JSON.stringify([
      { value: "very_manageable", label: "Very manageable", score: 0 },
      { value: "manageable", label: "Manageable", score: 1 },
      { value: "difficult", label: "Difficult", score: 3 },
      { value: "overwhelming", label: "Overwhelming", score: 5 },
    ]),
    scoringMeta: "{}",
    category: "Operational Stress",
    order: 1,
    active: true,
  },
  {
    code: "SLEEP_QUALITY",
    questionText: "How has your sleep quality and rest felt recently during duty rotations?",
    questionType: "single_choice",
    options: JSON.stringify([
      { value: "restful", label: "Restful and sufficient", score: 0 },
      { value: "mixed", label: "Mixed or light sleep", score: 2 },
      { value: "disrupted", label: "Frequently disrupted", score: 4 },
      { value: "very_disrupted", label: "Very disrupted / Insomnia", score: 5 },
    ]),
    scoringMeta: "{}",
    category: "Sleep & Recovery",
    order: 2,
    active: true,
  },
  {
    code: "SOCIAL_SUPPORT",
    questionText: "How connected have you felt to your unit peers and family members?",
    questionType: "single_choice",
    options: JSON.stringify([
      { value: "connected", label: "Strongly connected", score: 0 },
      { value: "somewhat", label: "Somewhat connected", score: 1 },
      { value: "distant", label: "Distant from peers", score: 3 },
      { value: "isolated", label: "Completely isolated", score: 5 },
    ]),
    scoringMeta: "{}",
    category: "Social Connection",
    order: 3,
    active: true,
  },
  {
    code: "RECOVERY_ABILITY",
    questionText: "How often have you been able to decompress and recover after high-tempo duties?",
    questionType: "single_choice",
    options: JSON.stringify([
      { value: "often", label: "Often able to decompress", score: 0 },
      { value: "sometimes", label: "Sometimes able", score: 2 },
      { value: "rarely", label: "Rarely able", score: 4 },
      { value: "not_at_all", label: "Not at all able", score: 5 },
    ]),
    scoringMeta: "{}",
    category: "Resilience & Recovery",
    order: 4,
    active: true,
  },
  {
    code: "ENERGY_LEVEL",
    questionText: "How would you describe your overall physical and mental energy levels?",
    questionType: "single_choice",
    options: JSON.stringify([
      { value: "steady", label: "Steady and alert", score: 0 },
      { value: "variable", label: "Variable throughout shift", score: 2 },
      { value: "low", label: "Low energy", score: 4 },
      { value: "exhausted", label: "Completely exhausted / Burnout", score: 5 },
    ]),
    scoringMeta: "{}",
    category: "Burnout & Energy",
    order: 5,
    active: true,
  },
];


// GET /api/assessments & /api/assessments/current — active questions for the onboarding/assessment flow.
export async function _GET() {
  const { user } = await requireAuth();
  let questions = await db.assessmentQuestion.findMany({
    where: { active: true },
    orderBy: { order: "asc" },
  });

  if (questions.length === 0) {
    for (const q of DEFAULT_QUESTIONS) {
      await db.assessmentQuestion.create({ data: q });
    }
    questions = await db.assessmentQuestion.findMany({
      where: { active: true },
      orderBy: { order: "asc" },
    });
  }

  await logAudit({ actorId: user.id, action: "assessment_questions_viewed", targetType: "AssessmentQuestion" });
  return Response.json({
    questions: questions.map((q) => ({
      id: q.id, code: q.code, questionText: q.questionText,
      questionType: q.questionType,
      options: typeof q.options === "string" ? JSON.parse(q.options) : q.options,
      category: q.category, order: q.order,
    })),
  });
}


const submitSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string(),
    questionCode: z.string(),
    value: z.string(),
  })).min(1),
});

// POST /api/assessments — submit assessment. Scoring is ALWAYS server-side.
async function _POST(req: NextRequest) {
  const { user } = await requireAuth();
  if (user.role !== "USER") return jsonError("Only CRPF personnel can complete assessments.", 403, "USER_ONLY");
  let body: unknown;
  try { body = await req.json(); } catch { return jsonError("Invalid JSON", 400); }
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid input", 422);

  // Look up scoring for each answer from the DB (never trust client scores).
  const questionIds = parsed.data.answers.map((a) => a.questionId);
  const questions = await db.assessmentQuestion.findMany({ where: { id: { in: questionIds } } });
  const qMap = new Map(questions.map((q) => [q.id, q]));

  const scored = parsed.data.answers.map((a) => {
    const q = qMap.get(a.questionId);
    let score = 0;
    if (q) {
      const options = JSON.parse(q.options) as { value: string; score: number }[];
      const opt = options.find((o) => o.value === a.value);
      score = opt?.score ?? 0;
    }
    return { code: a.questionCode, value: a.value, score, questionId: a.questionId };
  });

  const session = await db.assessmentSession.create({
    data: { userId: user.id, completedAt: new Date() },
  });
  await db.assessmentAnswer.createMany({
    data: scored.map((s) => ({
      sessionId: session.id, questionId: s.questionId,
      questionCode: s.code, value: s.value, score: s.score,
    })),
  });

  const result = await getAIProvider().analyzeAssessment(scored);
  const ar = await db.assessmentResult.create({
    data: {
      sessionId: session.id, userId: user.id,
      totalScore: result.totalScore, normalizedScore: result.normalizedScore,
      wellbeingLevel: result.level, signalsJson: JSON.stringify(result.signals),
    },
  });

  // mark onboarding complete
  await db.user.update({ where: { id: user.id }, data: { onboardingComplete: true, firstLogin: false } });

  // feed risk engine
  if (["ELEVATED", "HIGH", "CRITICAL"].includes(result.level)) {
    await triggerRiskFromContent({
      userId: user.id, source: "assessment", level: result.level,
      confidence: result.normalizedScore / 100, signals: result.signals,
      reason: `Initial assessment result: ${result.level}`,
    });
  }

  await logAudit({
    actorId: user.id, action: AUDIT_ACTIONS.ASSESSMENT_SUBMITTED,
    targetType: "AssessmentResult", targetId: ar.id,
    metadata: { level: result.level, normalized: result.normalizedScore },
  });

  // NOTE: the raw score is intentionally NOT returned to the user.
  return Response.json({ ok: true, message: "Your check-in has been recorded." });
}

export const GET = apiRoute(_GET);
export const POST = apiRoute(_POST);
