"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FileText, AudioLines, ClipboardCheck, MessageCircleHeart,
  RefreshCw, Inbox, AlertTriangle, CalendarClock,
} from "lucide-react";
import { api, ApiRequestError } from "@/lib/api";
import { MOODS } from "@/lib/constants";
import type { JournalDTO } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/ui";
import { useApp } from "@/lib/store";

function fmtFull(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

interface RecentVoice { id: string; durationSec: number; transcript: string; createdAt: string; }
interface DashboardRecent {
  recent: { voiceEntries: RecentVoice[] };
}

interface AssessmentSession { id: string; completedAt: string; recorded: boolean; }
interface Conversation { id: string; title: string | null; createdAt: string; updatedAt: string; }

export default function HistoryView() {
  const { navigate } = useApp();
  const [tab, setTab] = useState<"journals" | "voice" | "assessments" | "conversations">("journals");

  const [journals, setJournals] = useState<JournalDTO[]>([]);
  const [jLoading, setJLoading] = useState(true);
  const [jError, setJError] = useState<string | null>(null);

  const [voice, setVoice] = useState<RecentVoice[]>([]);
  const [vLoading, setVLoading] = useState(false);

  const [sessions, setSessions] = useState<AssessmentSession[]>([]);
  const [sLoading, setSLoading] = useState(false);
  const [sError, setSError] = useState<string | null>(null);

  const [convs, setConvs] = useState<Conversation[]>([]);
  const [cLoading, setCLoading] = useState(false);

  const loadJournals = useCallback(async () => {
    setJLoading(true); setJError(null);
    try {
      const r = await api.get<{ journals: JournalDTO[] }>("/api/journals");
      setJournals(r.journals);
    } catch (e) {
      setJError(e instanceof ApiRequestError ? e.message : "Couldn't load journals.");
    } finally { setJLoading(false); }
  }, []);

  const loadVoice = useCallback(async () => {
    setVLoading(true);
    try {
      const d = await api.get<DashboardRecent>("/api/dashboard");
      setVoice(d.recent.voiceEntries ?? []);
    } catch { /* ignore */ } finally { setVLoading(false); }
  }, []);

  const loadSessions = useCallback(async () => {
    setSLoading(true); setSError(null);
    try {
      const r = await api.get<{ sessions: AssessmentSession[] }>("/api/assessments/history");
      setSessions(r.sessions);
    } catch (e) {
      setSError(e instanceof ApiRequestError ? e.message : "Couldn't load check-ins.");
    } finally { setSLoading(false); }
  }, []);

  const loadConvs = useCallback(async () => {
    setCLoading(true);
    try {
      const r = await api.get<{ conversations: Conversation[] }>("/api/ai/conversations");
      setConvs(r.conversations);
    } catch { /* ignore */ } finally { setCLoading(false); }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void loadJournals();
      void loadVoice();
      void loadSessions();
      void loadConvs();
    }, 0);
    return () => window.clearTimeout(id);
  }, [loadJournals, loadVoice, loadSessions, loadConvs]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="serif text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">History</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Your wellbeing activity over time.</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="journals" className="text-xs sm:text-sm">
            <FileText className="mr-1.5 h-3.5 w-3.5" /> Journals
          </TabsTrigger>
          <TabsTrigger value="voice" className="text-xs sm:text-sm">
            <AudioLines className="mr-1.5 h-3.5 w-3.5" /> Voice
          </TabsTrigger>
          <TabsTrigger value="assessments" className="text-xs sm:text-sm">
            <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" /> Check-ins
          </TabsTrigger>
          <TabsTrigger value="conversations" className="text-xs sm:text-sm">
            <MessageCircleHeart className="mr-1.5 h-3.5 w-3.5" /> Chats
          </TabsTrigger>
        </TabsList>

        {/* JOURNALS */}
        <TabsContent value="journals" className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{journals.length} journal entries</p>
            <Button variant="ghost" size="sm" onClick={loadJournals} disabled={jLoading}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${jLoading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
          {jLoading ? (
            <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
          ) : jError ? (
            <EmptyState icon={AlertTriangle} title="Couldn't load journals" description={jError}
              action={<Button onClick={loadJournals} variant="outline"><RefreshCw className="mr-2 h-4 w-4" />Retry</Button>} />
          ) : journals.length === 0 ? (
            <EmptyState icon={Inbox} title="No journal entries yet"
              description="Write your first reflection in the Daily Journal."
              action={<Button onClick={() => navigate("daily-log")}>Go to Daily Journal</Button>} />
          ) : (
            <ul className="space-y-3">
              {journals.map((j) => {
                const mood = MOODS.find((m) => m.value === j.mood);
                return (
                  <li key={j.id}>
                    <Card className="border-border/60 transition-colors hover:border-primary/30">
                      <CardContent className="p-4">
                        <div className="mb-1 flex items-center gap-2">
                          {mood && <span aria-hidden className="text-base">{mood.emoji}</span>}
                          <span className="text-xs font-medium text-foreground">{fmtFull(j.createdAt)}</span>
                          <Badge variant={j.status === "DRAFT" ? "secondary" : "default"} className="ml-auto text-[10px]">
                            {j.status === "DRAFT" ? "Draft" : "Submitted"}
                          </Badge>
                        </div>
                        <p className="line-clamp-3 text-sm leading-relaxed text-foreground/85">{j.content}</p>
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>

        {/* VOICE */}
        <TabsContent value="voice" className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{voice.length} recent voice notes</p>
            <Button variant="ghost" size="sm" onClick={loadVoice} disabled={vLoading}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${vLoading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
          {vLoading ? (
            <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : voice.length === 0 ? (
            <EmptyState icon={Inbox} title="No voice notes yet"
              description="Record your first voice journal entry."
              action={<Button onClick={() => navigate("voice-journal")}>Open Voice Journal</Button>} />
          ) : (
            <ul className="space-y-3">
              {voice.map((v) => (
                <li key={v.id}>
                  <Card className="border-border/60">
                    <CardContent className="p-4">
                      <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <AudioLines className="h-3.5 w-3.5 text-primary" />
                        <span>Voice note · {Math.round(v.durationSec)}s</span>
                        <span className="ml-auto">{fmtFull(v.createdAt)}</span>
                      </div>
                      <p className="line-clamp-3 text-sm leading-relaxed text-foreground/85">{v.transcript}</p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        {/* ASSESSMENTS */}
        <TabsContent value="assessments" className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{sessions.length} recorded check-ins</p>
            <Button variant="ghost" size="sm" onClick={loadSessions} disabled={sLoading}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${sLoading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
          {sLoading ? (
            <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : sError ? (
            <EmptyState icon={AlertTriangle} title="Couldn't load check-ins" description={sError}
              action={<Button onClick={loadSessions} variant="outline"><RefreshCw className="mr-2 h-4 w-4" />Retry</Button>} />
          ) : sessions.length === 0 ? (
            <EmptyState icon={CalendarClock} title="No check-ins yet"
              description="Take your first wellbeing check-in to get started."
              action={<Button onClick={() => navigate("assessment")}>Take check-in</Button>} />
          ) : (
            <ul className="space-y-3">
              {sessions.map((s) => (
                <li key={s.id}>
                  <Card className="border-border/60">
                    <CardContent className="flex items-center gap-3 p-4">
                      <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <ClipboardCheck className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">Check-in recorded</p>
                        <p className="text-xs text-muted-foreground">{fmtFull(s.completedAt)}</p>
                      </div>
                      <Badge variant="secondary" className="text-[10px]">Completed</Badge>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            For your privacy, individual check-in results are not displayed here.
          </p>
        </TabsContent>

        {/* CONVERSATIONS */}
        <TabsContent value="conversations" className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{convs.length} conversations</p>
            <Button variant="ghost" size="sm" onClick={loadConvs} disabled={cLoading}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${cLoading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
          {cLoading ? (
            <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : convs.length === 0 ? (
            <EmptyState icon={Inbox} title="No conversations yet"
              description="Start a chat with your AI Companion."
              action={<Button onClick={() => navigate("ai-companion")}>Open AI Companion</Button>} />
          ) : (
            <ul className="space-y-3">
              {convs.map((c) => (
                <li key={c.id}>
                  <Card className="border-border/60">
                    <CardContent className="flex items-center gap-3 p-4">
                      <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <MessageCircleHeart className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{c.title || "New conversation"}</p>
                        <p className="text-xs text-muted-foreground">Updated {fmtDate(c.updatedAt)}</p>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
