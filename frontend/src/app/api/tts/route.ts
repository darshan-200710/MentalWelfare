import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { jsonError, apiRoute } from "@/lib/api-shared";
import { z } from "zod";
// Pre-import ZAI SDK at module level to eliminate cold-import latency on fallback
import ZAI from "z-ai-web-dev-sdk";

const ML_BASE_URL = process.env.ML_SERVICE_URL || "http://127.0.0.1:8001";


export const dynamic = "force-dynamic";

const schema = z.object({
  text: z.string().min(1).max(1024, "TTS input limited to 1024 characters"),
});

// POST /api/tts — generates spoken audio for AI companion voice output.
// Returns a WAV audio blob (server-only SDK call).
async function _POST(req: NextRequest) {
  const { user } = await requireAuth();
  let body: unknown;
  try { body = await req.json(); } catch { return jsonError("Invalid JSON", 400); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid input", 422);

  const text = parsed.data.text.trim();
  if (!text) return jsonError("Empty text", 400);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s TTS timeout
    const mlResp = await fetch(`${ML_BASE_URL}/api/ml/voice/synthesize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.slice(0, 1024) }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (mlResp.ok) {
      const buffer = await mlResp.arrayBuffer();
      return new Response(buffer, {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
          "Content-Length": buffer.byteLength.toString(),
          "Cache-Control": "no-store",
        },
      });
    }

    // Fallback to ZAI (pre-imported at module level)
    const zai = await ZAI.create();
    const response = await zai.audio.tts.create({
      input: text.slice(0, 1024),
      voice: "tongtong",
      speed: 1.0,
      response_format: "wav",
      stream: false,
    });
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(new Uint8Array(arrayBuffer));
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[tts] failed:", e);
    return jsonError("Voice output unavailable right now. Please try again.", 503, "TTS_UNAVAILABLE");
  }

}

export const POST = apiRoute(_POST);
