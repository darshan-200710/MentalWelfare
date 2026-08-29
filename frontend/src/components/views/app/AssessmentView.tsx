"use client";

import { useState } from "react";
import {
  ClipboardCheck, ArrowRight, ArrowLeft, CheckCircle2, ShieldCheck,
  HeartPulse, AlertTriangle, LockKeyhole,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { api, ApiRequestError } from "@/lib/api";
import type { AssessmentQuestionDTO } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/shared/ui";
import { toast } from "sonner";

type Stage = "intro" | "questions" | "submitting" | "done" | "error";

interface FetchState {
  loading: boolean;
  error?: string;
  questions?: AssessmentQuestionDTO[];
}

export default function AssessmentView() {
  const { user, navigate } = useApp();
  const isRetake = !!user?.onboardingComplete;

  const [stage, setStage] = useState<Stage>("intro");
  const [fetch, setFetch] = useState<FetchState>({ loading: false });
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { value: string; questionCode: string; questionId: string }>>({});

  async function start() {
    setStage("questions");
    if (fetch.questions) return;
    setFetch({ loading: true });
    try {
      const res = await api.get<{ questions: AssessmentQuestionDTO[] }>("/api/assessments/current");
      if (!res.questions?.length) {
        setFetch({ loading: false, error: "No assessment questions available right now." });
        setStage("error");
        return;
      }
      setFetch({ loading: false, questions: res.questions });
    } catch (e) {
      const msg = e instanceof ApiRequestError ? e.message : "Failed to load questions.";
      setFetch({ loading: false, error: msg });
      setStage("error");
    }
  }

  function pick(q: AssessmentQuestionDTO, value: string) {
    setAnswers((prev) => ({
      ...prev,
      [q.id]: { value, questionCode: q.code, questionId: q.id },
    }));
  }

  function next() {
    if (!fetch.questions) return;
    if (current < fetch.questions.length - 1) setCurrent((c) => c + 1);
    else submit();
  }
  function back() {
    if (current > 0) setCurrent((c) => c - 1);
  }

  async function submit() {
    if (!fetch.questions) return;
    setStage("submitting");
    try {
      const payload = Object.values(answers).map((a) => ({
        questionId: a.questionId,
        questionCode: a.questionCode,
        value: a.value,
      }));
      await api.post("/api/assessments", { answers: payload });
      // refresh user from /api/auth/me so onboardingComplete flips
      try {
        const me = await api.get<{ user: import("@/lib/types").SafeUser | null }>("/api/auth/me");
        if (me?.user) useApp.getState().setUser(me.user);
      } catch { /* ignore */ }
      setStage("done");
      toast.success("Check-in recorded");
    } catch (e) {
      const msg = e instanceof ApiRequestError ? e.message : "Something went wrong submitting your check-in.";
      toast.error(msg);
      setStage("questions");
    }
  }

  // INTRO ---------------------------------------------------------------
  if (stage === "intro") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
        <div className="text-center">
          <div className="mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <HeartPulse className="h-7 w-7" strokeWidth={2} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {isRetake ? "Re-take check-in" : "Welcome to CRPF MHS"}
          </p>
          <h1 className="serif mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {isRetake ? "Let's check in again" : "Let's start with a quick check-in"}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
            This is a brief, confidential wellbeing check-in. There are no right or wrong
            answers — just respond honestly so we can better understand how you're doing and
            connect you with the right support when needed.
          </p>
        </div>

        <Card className="mt-10 overflow-hidden border-border/60">
          <CardContent className="grid gap-0 p-0 sm:grid-cols-3">
            {[
              { icon: ClipboardCheck, title: "A few minutes", text: "Around 9 short questions." },
              { icon: ShieldCheck, title: "Private & secure", text: "Your responses are encrypted and access-controlled." },
              { icon: HeartPulse, title: "No labels", text: "We don't show scores — just a gentle summary." },
            ].map((f, i) => (
              <div key={i} className="border-b border-border/60 p-5 last:border-b-0 sm:border-b-0 sm:[&:not(:last-child)]:border-r">
                <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <f.icon className="h-4 w-4" />
                </div>
                <p className="text-sm font-medium text-foreground">{f.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{f.text}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="mt-8 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-sm leading-relaxed">
            This is an <strong>AI-assisted wellbeing system</strong>, not a medical diagnosis.
            If you are in immediate distress or danger, please contact your local emergency
            services or a qualified clinician.
          </p>
        </div>

        <div className="mt-8 flex flex-col items-center gap-3">
          <Button size="lg" onClick={start} className="w-full max-w-xs">
            {isRetake ? "Re-take wellbeing check-in" : "Begin check-in"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          {isRetake && (
            <Button variant="ghost" size="sm" onClick={() => navigate("dashboard")}>
              Back to dashboard
            </Button>
          )}
        </div>
      </div>
    );
  }

  // LOADING / ERROR -----------------------------------------------------
  if (stage === "error") {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
        <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">We couldn't load your check-in</h2>
        <p className="mt-2 text-sm text-muted-foreground">{fetch.error ?? "Please try again."}</p>
        <Button className="mt-6" onClick={() => { setStage("intro"); setFetch({ loading: false }); }}>
          Try again
        </Button>
      </div>
    );
  }

  if (stage === "done") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-20">
        <div className="text-center">
          <div className="mx-auto mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-8 w-8" strokeWidth={2.2} />
          </div>
          <h1 className="serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Your check-in has been recorded.
          </h1>
          <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
            Thank you for taking a moment to reflect. Your responses are kept private and
            used only to help us recognise when you might benefit from support.
          </p>
        </div>

        <Card className="mt-10 border-border/60 bg-primary/5">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <HeartPulse className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">What happens next?</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your dashboard has gentle check-ins, journaling, voice notes, and a 24/7
                  AI companion. If at any time we notice signals that warrant extra support,
                  a trained professional may reach out — confidentially.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          AI-assisted wellbeing system — not a medical diagnosis.
        </p>

        <div className="mt-8 flex justify-center">
          <Button size="lg" onClick={() => navigate("dashboard")}>
            Go to dashboard
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // QUESTIONS -----------------------------------------------------------
  if (!fetch.questions || fetch.loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <div className="flex flex-col items-center gap-3 py-16">
          <Spinner className="h-6 w-6 text-primary" />
          <p className="text-sm text-muted-foreground">Preparing your check-in…</p>
        </div>
      </div>
    );
  }

  const q = fetch.questions[current];
  const total = fetch.questions.length;
  const progress = ((current + (answers[q.id] ? 1 : 0)) / total) * 100;
  const answered = Object.keys(answers).length;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      {/* Progress header */}
      <div className="mb-8">
        <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>
            Question {current + 1} of {total}
          </span>
          <span>{answered}/{total} answered</span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      <div className="mb-6">
        {q.category && (
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">{q.category}</p>
        )}
        <h2 className="serif text-xl font-semibold leading-snug text-foreground sm:text-2xl">
          {q.questionText}
        </h2>
      </div>

      <fieldset className="space-y-2.5">
        <legend className="sr-only">Answer options</legend>
        {q.options.map((opt) => {
          const selected = answers[q.id]?.value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => pick(q, opt.value)}
              aria-pressed={selected}
              className={cn(
                "group flex w-full items-center gap-3 rounded-lg border px-4 py-3.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                selected
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border bg-card hover:border-primary/40 hover:bg-muted/40"
              )}
            >
              <span
                className={cn(
                  "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                  selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"
                )}
              >
                {selected && <CheckCircle2 className="h-3.5 w-3.5" />}
              </span>
              <span className={cn("text-sm font-medium", selected ? "text-foreground" : "text-foreground/80")}>
                {opt.label}
              </span>
            </button>
          );
        })}
      </fieldset>

      <div className="mt-8 flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={back} disabled={current === 0 || stage === "submitting"}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
        </Button>
        <div className="flex items-center gap-2">
          {current < total - 1 && (
            <Button variant="ghost" onClick={() => setCurrent((c) => Math.min(c + 1, total - 1))} disabled={stage === "submitting"}>
              Skip
            </Button>
          )}
          <Button onClick={next} disabled={!answers[q.id] || stage === "submitting"}>
            {stage === "submitting" && <Spinner className="mr-2 h-4 w-4" />}
            {current === total - 1 ? "Submit check-in" : "Next"}
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      </div>

      <p className="mt-8 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <LockKeyhole className="h-3 w-3" />
        Your responses are private and stored securely.
      </p>
    </div>
  );
}
