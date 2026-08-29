"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  BookHeart, Mic, ClipboardCheck, History as HistoryIcon,
  BookOpen, LifeBuoy, Flame, FileText, AudioLines, Sparkles, ArrowRight,
  AlertTriangle, CalendarClock, RefreshCw,
  Square, Volume2, VolumeX,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { api, ApiRequestError } from "@/lib/api";
import { MOODS } from "@/lib/constants";
import type { Mood } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, Spinner } from "@/components/shared/ui";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { SpeechRecognitionLike } from "@/lib/speech";

interface DashboardData {
  user: import("@/lib/types").SafeUser;
  streak: { current: number; longest: number; lastCheckIn: string | null };
  stats: { checkIns: number; journals: number; voiceEntries: number; conversations: number };
  recent: {
    journals: { id: string; mood: Mood | null; status: "DRAFT" | "SUBMITTED"; createdAt: string; preview: string }[];
    voiceEntries: { id: string; durationSec: number; transcript: string; createdAt: string }[];
    conversations: { id: string; title: string | null; updatedAt: string }[];
  };
  needsOnboarding: boolean;
}

function greeting(language: "en" | "hi") {
  const h = new Date().getHours();
  if (language === "hi") {
    if (h < 12) return "सुप्रभात";
    if (h < 18) return "नमस्कार";
    return "शुभ संध्या";
  }
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function fmtTimeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function DashboardView() {
  const { user, navigate } = useApp();
  const language = useApp((s) => s.language);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Quick journal composer state
  const [draftMood, setDraftMood] = useState<Mood | null>(null);
  const [draftText, setDraftText] = useState("");
  const [saving, setSaving] = useState<"idle" | "draft" | "submit">("idle");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const d = await api.get<DashboardData>("/api/dashboard");
      setData(d);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Couldn't load your dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadId = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(loadId);
  }, [load]);

  useEffect(() => () => {
    recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();
  }, []);

  function toggleSpeechToText() {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      toast.error("Speech-to-text is not supported in this browser.");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = "en-IN";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const text = Array.from(event.results)
        .slice(event.resultIndex)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ");
      setDraftText((current) => `${current}${current ? " " : ""}${text}`.slice(0, 10000));
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => {
      setIsListening(false);
      toast.error("Speech recognition stopped.");
    };
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }

  function toggleTextToSpeech() {
    if (!draftText.trim()) {
      toast.error("Write or dictate a reflection first.");
      return;
    }
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    if (!window.speechSynthesis) {
      toast.error("Text-to-speech is not supported in this browser.");
      return;
    }
    const utterance = new SpeechSynthesisUtterance(draftText);
    utterance.lang = "en-IN";
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  }

  async function saveDraft(status: "DRAFT" | "SUBMITTED") {
    if (!draftText.trim()) {
      toast.error("Please write a short reflection first.");
      return;
    }
    setSaving(status === "DRAFT" ? "draft" : "submit");
    try {
      await api.post("/api/journals", { mood: draftMood, content: draftText.trim(), status });
      toast.success(status === "DRAFT" ? "Draft saved." : "Entry recorded — thank you.");
      setDraftText(""); setDraftMood(null);
      await load();
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? e.message : "Failed to save entry.");
    } finally {
      setSaving("idle");
    }
  }

  const firstName = user?.name?.split(" ")[0] || (user?.email?.split("@")[0] ?? "there");

  if (loading) return <DashboardSkeleton />;
  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <EmptyState icon={AlertTriangle} title="Couldn't load dashboard" description={error ?? "Please try again."}
          action={<Button onClick={load} variant="outline"><RefreshCw className="mr-2 h-4 w-4" />Retry</Button>} />
      </div>
    );
  }

  const quickActions = [
    { key: "daily-log",     label: "Daily Journal", desc: "Reflect and write", icon: BookHeart },
    { key: "voice-journal", label: "Voice Journal", desc: "Speak your mind",   icon: Mic },
    { key: "assessment",   label: "Wellbeing Check-In", desc: "Re-take check-in", icon: ClipboardCheck },
    { key: "history",       label: "History",        desc: "Your past entries",  icon: HistoryIcon },
    { key: "resources",     label: "Resources",      desc: "Guides & articles",  icon: BookOpen },
    { key: "support",       label: "Get Support",    desc: "Talk to a person",   icon: LifeBuoy },
  ] as const;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Onboarding banner */}
      {data.needsOnboarding && (
        <Card className="mb-6 border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Complete your welcome check-in</p>
                <p className="text-xs text-muted-foreground">A quick wellbeing check-in helps us tailor support for you.</p>
              </div>
            </div>
            <Button size="sm" onClick={() => navigate("assessment")}>
              Start check-in <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="serif text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {greeting(language)}, {firstName}
        </h1>
      </div>

      {/* Mood selector */}
      <Card className="mb-6 border-border/60">
        <CardContent className="p-4 sm:p-5">
          <p className="mb-3 text-sm font-medium text-foreground">How are you feeling today?</p>
          <div className="flex flex-wrap gap-2">
            {MOODS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setDraftMood(draftMood === m.value ? null : m.value)}
                aria-pressed={draftMood === m.value}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  draftMood === m.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:border-primary/40 hover:bg-muted/40"
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Daily check-in composer */}
        <div className="lg:col-span-2">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-foreground">Daily check-in</CardTitle>
              <p className="text-xs text-muted-foreground">A short reflection — share as much or as little as you'd like.</p>
            </CardHeader>
            <CardContent>
              <Textarea
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                placeholder="What would you like to reflect on today?"
                rows={5}
                maxLength={10000}
                className="resize-none"
                aria-label="Reflection text"
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={toggleSpeechToText} aria-label={isListening ? "Stop speech to text" : "Start speech to text"} className={cn(isListening && "border-destructive text-destructive hover:text-destructive")}>
                  {isListening ? <Square className="mr-1.5 h-3.5 w-3.5" /> : <Mic className="mr-1.5 h-3.5 w-3.5" />}
                  {isListening ? "Stop dictation" : "Speak to type"}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={toggleTextToSpeech} aria-label={isSpeaking ? "Stop reading reflection aloud" : "Read reflection aloud"}>
                  {isSpeaking ? <VolumeX className="mr-1.5 h-3.5 w-3.5" /> : <Volume2 className="mr-1.5 h-3.5 w-3.5" />}
                  {isSpeaking ? "Stop reading" : "Read aloud"}
                </Button>
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">{draftText.length} / 10,000 characters</p>
                <div className="flex gap-2">
                  <Button
                    variant="outline" size="sm"
                    onClick={() => saveDraft("DRAFT")}
                    disabled={saving !== "idle" || !draftText.trim()}
                  >
                    {saving === "draft" && <Spinner className="mr-2 h-4 w-4" />}
                    Save Draft
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => saveDraft("SUBMITTED")}
                    disabled={saving !== "idle" || !draftText.trim()}
                  >
                    {saving === "submit" && <Spinner className="mr-2 h-4 w-4" />}
                    Submit Entry
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick actions */}
          <div className="mt-6">
            <h2 className="mb-3 text-sm font-semibold text-foreground">Quick actions</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {quickActions.map((a) => (
                <button
                  key={a.key}
                  onClick={() => navigate(a.key as any)}
                  className="group flex flex-col items-start gap-2 rounded-xl border border-border/60 bg-card p-4 text-left transition-all hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <a.icon className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-medium text-foreground">{a.label}</span>
                  <span className="text-xs text-muted-foreground">{a.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right column: stats + recent */}
        <div className="space-y-6">
          <div>
            <h2 className="mb-3 text-sm font-semibold text-foreground">Your activity</h2>
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon={Flame} label="Check-in streak" value={`${data.streak.current}`} suffix="days" />
              <StatCard icon={ClipboardCheck} label="Check-ins" value={`${data.stats.checkIns}`} />
              <StatCard icon={FileText} label="Journals" value={`${data.stats.journals}`} />
              <StatCard icon={AudioLines} label="Voice notes" value={`${data.stats.voiceEntries}`} />
            </div>
          </div>

          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-foreground">Recent activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <RecentList data={data} navigate={navigate} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, suffix }: { icon: any; label: string; value: string; suffix?: string }) {
  return (
    <Card className="border-border/60 bg-card">
      <CardContent className="p-3.5">
        <div className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <p className="text-2xl font-semibold tracking-tight text-foreground">{value}{suffix && <span className="ml-1 text-xs font-normal text-muted-foreground">{suffix}</span>}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function RecentList({ data, navigate }: { data: DashboardData; navigate: any }) {
  const items: { kind: "journal" | "voice" | "ai"; title: string; sub: string; at: string; onClick: () => void }[] = [];
  for (const j of data.recent.journals.slice(0, 3)) {
    const m = MOODS.find((x) => x.value === j.mood);
    items.push({
      kind: "journal",
      title: (m?.emoji ?? "📝") + "  " + j.preview.slice(0, 60) + (j.preview.length > 60 ? "…" : ""),
      sub: `Journal · ${j.status === "DRAFT" ? "Draft" : "Submitted"}`,
      at: fmtTimeAgo(j.createdAt),
      onClick: () => navigate("daily-log"),
    });
  }
  for (const v of data.recent.voiceEntries.slice(0, 2)) {
    items.push({
      kind: "voice",
      title: "🎙️  " + v.transcript.slice(0, 60) + (v.transcript.length > 60 ? "…" : ""),
      sub: `Voice note · ${Math.round(v.durationSec)}s`,
      at: fmtTimeAgo(v.createdAt),
      onClick: () => navigate("voice-journal"),
    });
  }
  for (const c of data.recent.conversations.slice(0, 2)) {
    items.push({
      kind: "ai",
      title: "💬  " + (c.title || "Conversation"),
      sub: "AI Companion",
      at: fmtTimeAgo(c.updatedAt),
      onClick: () => navigate("ai-companion"),
    });
  }

  if (!items.length) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="Nothing yet"
        description="Your recent journals, voice notes, and chats will appear here."
      />
    );
  }
  return (
    <ul className="space-y-1">
      {items.map((it, i) => (
        <li key={i}>
          <button
            onClick={it.onClick}
            className="w-full rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <p className="truncate text-sm text-foreground">{it.title}</p>
            <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{it.sub}</span>
              <span>{it.at}</span>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <Skeleton className="mb-6 h-8 w-56" />
      <Skeleton className="mb-6 h-20 w-full" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    </div>
  );
}
