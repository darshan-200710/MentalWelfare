import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getAIProvider } from "@/lib/ai/provider";
import { triggerRiskFromContent } from "@/lib/risk-engine";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit";
import { jsonError, apiRoute } from "@/lib/api-shared";
import { z } from "zod";

export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB upload cap
const ALLOWED_MIMES = new Set(["audio/wav", "audio/x-wav", "audio/mpeg", "audio/mp3", "audio/webm", "audio/ogg", "audio/m4a", "audio/x-m4a"]);

const bodySchema = z.object({
  audio: z.string().min(1),               // base64 data URL or raw base64
  mime: z.string().min(1),
  durationSec: z.number().min(0).max(3600).default(0),
});

// POST /api/voice/transcribe — receives base64 audio, runs server-side STT,
// returns transcript for the user to review/edit before final submission.
async function _POST(req: NextRequest) {
  const { user } = await requireAuth();
  if (user.role !== "USER") return jsonError("Only CRPF personnel can create voice entries.", 403, "USER_ONLY");
  let body: unknown;
  try { body = await req.json(); } catch { return jsonError("Invalid JSON", 400); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid input", 422);

  const { mime, durationSec } = parsed.data;
  const baseMime = (mime || "").split(";")[0].trim().toLowerCase();
  const isAllowed = baseMime.startsWith("audio/") || baseMime === "video/webm" || ALLOWED_MIMES.has(baseMime);
  if (!isAllowed) return jsonError("Unsupported audio format.", 415, "BAD_MIME");


  let b64 = parsed.data.audio;
  const comma = b64.indexOf(",");
  if (b64.startsWith("data:") && comma > -1) b64 = b64.slice(comma + 1);
  const buf = Buffer.from(b64, "base64");
  if (buf.length === 0) return jsonError("Empty audio payload.", 400);
  if (buf.length > MAX_BYTES) return jsonError("Audio exceeds maximum allowed size (10MB).", 413, "TOO_LARGE");

  let transcript = "";
  try {
    const mlUrl = process.env.ML_SERVICE_URL || "http://127.0.0.1:8001";
    const formData = new FormData();
    const audioBlob = new Blob([buf], { type: mime });
    formData.append("file", audioBlob, "audio.wav");

    const mlResp = await fetch(`${mlUrl}/api/ml/voice/transcribe`, {
      method: "POST",
      body: formData,
    });

    if (mlResp.ok) {
      const data = await mlResp.json();
      transcript = (data.transcript ?? "").trim();
    } else {
      throw new Error(`ML service returned ${mlResp.status}`);
    }
  } catch (mlErr) {
    console.warn("[voice] ML service Whisper STT unavailable, trying fallback:", mlErr);
    try {
      const ZAI = (await import("z-ai-web-dev-sdk")).default;
      const zai = await ZAI.create();
      const resp = await zai.audio.asr.create({ file_base64: b64 });
      transcript = (resp.text ?? "").trim();
    } catch (e) {
      console.error("[voice] STT failed, using note prompt:", e);
      transcript = "Recorded voice entry. Please review or edit your transcript before saving.";
    }

  }


  let analysis: any = null;
  let wellbeingLevel: string | null = null;
  try {
    analysis = await getAIProvider().analyzeJournal(transcript);
    wellbeingLevel = analysis.wellbeing_signal;
  } catch (e) { console.error("[voice] analysis failed:", e); }

  const entry = await db.voiceEntry.create({
    data: {
      userId: user.id, audioMime: mime, audioSize: buf.length,
      durationSec, transcript, editedTranscript: transcript,
      analysisJson: analysis ? JSON.stringify(analysis) : null,
      wellbeingLevel,
    },
  });

  if (analysis && wellbeingLevel && ["ELEVATED", "HIGH", "CRITICAL"].includes(wellbeingLevel)) {
    await triggerRiskFromContent({
      userId: user.id, source: "voice", level: wellbeingLevel as any,
      confidence: analysis.confidence, signals: analysis.signals,
      reason: `Voice journal analysis: ${analysis.signals.join(", ")}`,
    });
  }

  await logAudit({ actorId: user.id, action: AUDIT_ACTIONS.VOICE_TRANSCRIBE, targetType: "VoiceEntry", targetId: entry.id });

  return Response.json({
    id: entry.id,
    transcript,
    durationSec,
    wellbeingLevel,
  });
}

export const POST = apiRoute(_POST);
