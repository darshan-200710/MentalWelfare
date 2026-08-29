"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Mic, Square, RefreshCw, Check, X, LockKeyhole, AudioLines, Inbox,
  AlertTriangle, Clock, Pencil,
} from "lucide-react";
import { api, ApiRequestError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, Spinner } from "@/components/shared/ui";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Phase = "idle" | "recording" | "stopping" | "transcribing" | "review";

interface RecentVoice {
  id: string; durationSec: number; transcript: string; createdAt: string;
}

function fmtDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
function fmtAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function VoiceJournalView() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Recent voice entries (we use /api/dashboard for now)
  const [recent, setRecent] = useState<RecentVoice[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mimeRef = useRef<string>("audio/webm");

  const loadRecent = useCallback(async () => {
    setLoadingRecent(true);
    try {
      const d = await api.get<{
        recent: { voiceEntries: RecentVoice[] };
      }>("/api/dashboard");
      setRecent(d.recent.voiceEntries ?? []);
    } catch {
      // ignore — non-critical
    } finally {
      setLoadingRecent(false);
    }
  }, []);

  useEffect(() => {
    const loadId = window.setTimeout(() => { void loadRecent(); }, 0);
    return () => window.clearTimeout(loadId);
  }, [loadRecent]);

  useEffect(() => () => {
    // cleanup
    if (timerRef.current) clearInterval(timerRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try { recorderRef.current.stop(); } catch { /* ignore */ }
    }
  }, []);

  function tick() { setSeconds((s) => s + 1); }

  async function startRecording() {
    setErrorMsg(null); setTranscript(""); setVoiceId(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      // Choose a supported mime
      const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
      let mime = "";
      for (const c of candidates) {
        if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) { mime = c; break; }
      }
      mimeRef.current = mime || "audio/webm";
      const rec = new MediaRecorder(stream);
      recorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = handleStop;
      rec.start();
      setSeconds(0);
      timerRef.current = setInterval(tick, 1000);
      setPhase("recording");
    } catch (e: any) {
      const name = e?.name ?? "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setErrorMsg("Microphone access denied. Please allow microphone access in your browser settings and try again.");
      } else if (name === "NotFoundError") {
        setErrorMsg("No microphone found. Please connect one and try again.");
      } else {
        setErrorMsg(e?.message ?? "Could not start recording.");
      }
      setPhase("idle");
    }
  }

  function stopRecording() {
    setPhase("stopping");
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    }
    // stop mic tracks slightly later (in onstop) to ensure final chunk flushes
  }

  async function handleStop() {
    setPhase("transcribing");
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    const duration = seconds;
    try {
      const blob = new Blob(chunksRef.current, { type: mimeRef.current });
      if (blob.size === 0) {
        setErrorMsg("Recording was empty. Please try again.");
        setPhase("idle");
        return;
      }
      const dataUrl = await blobToDataUrl(blob);
      const r = await api.post<{ id: string; transcript: string; durationSec: number; wellbeingLevel: string | null }>(
        "/api/voice/transcribe",
        { audio: dataUrl, mime: mimeRef.current, durationSec: duration }
      );
      setTranscript(r.transcript || "");
      setVoiceId(r.id);
      setPhase("review");
      toast.success("Transcript ready — please review.");
    } catch (e) {
      setErrorMsg(e instanceof ApiRequestError ? e.message : "Transcription failed. Please try again.");
      setPhase("idle");
    }
  }

  async function submitTranscript() {
    if (!transcript.trim()) {
      toast.error("Please add or review your text before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/api/journals", { mood: null, content: transcript.trim(), status: "SUBMITTED" });
      toast.success("Voice journal saved.");
      setPhase("idle");
      setTranscript("");
      setVoiceId(null);
      setSeconds(0);
      await loadRecent();
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? e.message : "Failed to save entry.");
    } finally {
      setSubmitting(false);
    }
  }

  function cancelReview() {
    setPhase("idle");
    setTranscript("");
    setVoiceId(null);
    setSeconds(0);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6">
        <h1 className="serif text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Voice Journal</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Speak freely — your words are transcribed for you to review and edit before saving.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recorder / review */}
        <div className="lg:col-span-2">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
                <AudioLines className="h-4 w-4 text-primary" /> {phase === "review" ? "Review transcription" : "Record"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {errorMsg && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-destructive">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p className="text-sm">{errorMsg}</p>
                </div>
              )}

              {/* Idle / Recording / Transcribing */}
              {phase !== "review" && (
                <div className="flex flex-col items-center py-8">
                  {/* Big record / stop button */}
                  {phase === "recording" ? (
                    <button
                      onClick={stopRecording}
                      disabled={false}
                      aria-label="Stop recording"
                      className="rec-pulse inline-flex h-24 w-24 items-center justify-center rounded-full bg-destructive text-destructive-foreground transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 disabled:opacity-60"
                    >
                      <Square className="h-8 w-8" fill="currentColor" />
                    </button>
                  ) : phase === "transcribing" || phase === "stopping" ? (
                    <div className="inline-flex h-24 w-24 items-center justify-center rounded-full bg-muted">
                      <Spinner className="h-8 w-8 text-primary" />
                    </div>
                  ) : (
                    <button
                      onClick={startRecording}
                      aria-label="Start speaking"
                      className="inline-flex h-24 w-24 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4"
                    >
                      <Mic className="h-9 w-9" />
                    </button>
                  )}

                  <p className="mt-4 text-sm font-medium text-foreground">
                    {phase === "recording" ? "Recording…" :
                     phase === "stopping" ? "Stopping…" :
                     phase === "transcribing" ? "Transcribing your audio…" :
                     "Tap to start speaking"}
                  </p>

                  {/* Timer */}
                  {(phase === "recording" || phase === "stopping" || phase === "transcribing") && (
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm font-mono text-foreground">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      {fmtDuration(seconds)}
                    </div>
                  )}

                  {phase === "idle" && (
                    <Button variant="outline" size="sm" className="mt-6 sm:hidden" onClick={startRecording}>
                      <Mic className="mr-1.5 h-4 w-4" /> Start Speaking
                    </Button>
                  )}
                  {phase === "transcribing" && (
                    <p className="mt-2 text-xs text-muted-foreground">This may take a few seconds.</p>
                  )}
                </div>
              )}

              {/* Review phase */}
              {phase === "review" && (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
                    <Pencil className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <p className="text-xs leading-relaxed text-foreground/80">
                      Review and edit your transcript below. Nothing is saved until you press Submit.
                    </p>
                  </div>
                  <Textarea
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    rows={8}
                    maxLength={10000}
                    className="resize-none"
                    aria-label="Edit transcript"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{transcript.length} / 10,000</span>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={cancelReview}>
                        <X className="mr-1.5 h-3.5 w-3.5" /> Cancel
                      </Button>
                      <Button size="sm" onClick={submitTranscript} disabled={submitting || !transcript.trim()}>
                        {submitting ? <Spinner className="mr-2 h-4 w-4" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
                        Submit Entry
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="mt-4 flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 p-3.5">
            <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Audio is processed securely and transcribed server-side. The transcript is never auto-submitted —
              you always review before saving.
            </p>
          </div>
        </div>

        {/* Recent voice entries */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <AudioLines className="h-4 w-4 text-primary" /> Recent voice notes
            </h2>
            <Button variant="ghost" size="sm" onClick={loadRecent} disabled={loadingRecent}>
              <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", loadingRecent && "animate-spin")} />
            </Button>
          </div>
          {loadingRecent ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : recent.length === 0 ? (
            <EmptyState icon={Inbox} title="No voice notes yet" description="Your recent voice recordings will appear here." />
          ) : (
            <ul className="space-y-3 max-h-[640px] overflow-y-auto calm-scroll pr-1">
              {recent.map((v) => (
                <li key={v.id}>
                  <Card className="border-border/60">
                    <CardContent className="p-3.5">
                      <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <AudioLines className="h-3.5 w-3.5 text-primary" />
                        <span>Voice note</span>
                        <span>· {Math.round(v.durationSec)}s</span>
                        <span className="ml-auto">{fmtAgo(v.createdAt)}</span>
                      </div>
                      <p className="line-clamp-3 text-sm leading-relaxed text-foreground/85">{v.transcript}</p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
