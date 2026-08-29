"use client";

import { useEffect, useState, useCallback } from "react";
import { useApp } from "@/lib/store";
import { api, ApiRequestError } from "@/lib/api";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { LevelDot, LevelPill } from "@/components/shared/level-pill";
import { ROLE_LABELS, LEVEL_META } from "@/lib/constants";
import type {
  AlertSeverity, AlertStatus, Role, SupportStatus, UserStatus, WellbeingLevel, Mood,
} from "@/lib/types";
import {
  AdminPage, AuditedBadge, ErrorPanel, RestrictedNotice, RiskFootnote,
  StatusBadge, SupportStatusBadge, fmtDate, fmtDateTime, relTime,
} from "./_shared";
import {
  ArrowLeft, Mail, ShieldAlert, Calendar,
  ClipboardCheck, BookHeart, Mic, MessageCircleHeart, LifeBuoy,
  TriangleAlert, BadgeCheck, Clock,
} from "lucide-react";
import {
  Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis,
} from "recharts";

type Profile = {
  id: string; name: string | null; serviceNumber: string | null;
  unit: string | null; rank: string | null; role: Role;
  status: UserStatus; createdAt: string; lastLoginAt: string | null;
  lastActiveAt: string | null; onboardingComplete: boolean;
};
type LatestRisk = { level: WellbeingLevel; score: number; source: string; createdAt: string } | null;
type RiskTrendItem = { level: WellbeingLevel; source: string; createdAt: string };
type PersonAlert = {
  id: string; severity: AlertSeverity; status: AlertStatus; reason: string;
  source: string; createdAt: string; resolvedAt: string | null;
};
type SupportReq = { id: string; type: string; message: string; status: SupportStatus; createdAt: string };
type Assessment = { id: string; completedAt: string; level: WellbeingLevel | null; normalizedScore: number | null };
type Journal = {
  id: string; mood: Mood | null; content: string; status: string;
  wellbeingLevel: WellbeingLevel | null; createdAt: string;
};
type VoiceEntry = {
  id: string; durationSec: number; transcript: string;
  wellbeingLevel: WellbeingLevel | null; createdAt: string;
};
type Conversation = {
  id: string; title: string | null; createdAt: string;
  messages: { role: "user" | "assistant" | "system"; content: string; riskFlag: boolean; createdAt: string }[];
};

type PersonResp = {
  profile: Profile;
  latestRisk: LatestRisk;
  riskTrend: RiskTrendItem[];
  alerts: PersonAlert[];
  supportRequests: SupportReq[];
  assessments: Assessment[];
  journals: Journal[];
  conversations: Conversation[];
  voiceEntries: VoiceEntry[];
  visible: { risk: boolean; assessments: boolean; journals: boolean; conversations: boolean };
};

export default function AdminPersonView() {
  const { params, navigate, user } = useApp();
  const id = params.id;
  const [data, setData] = useState<PersonResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true); setError(null); setNotFound(false); setForbidden(false);
    try {
      const r = await api.get<PersonResp>(`/api/admin/personnel/${id}`);
      setData(r);
    } catch (e) {
      if (e instanceof ApiRequestError) {
        if (e.status === 404) setNotFound(true);
        else if (e.status === 403) setForbidden(true);
        else setError(e.message);
      } else setError(e instanceof Error ? e.message : "Failed to load record");
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => {
    const loadId = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(loadId);
  }, [load]);

  if (!id) {
    return (
      <AdminPage>
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate("admin-personnel")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to personnel
        </Button>
        <ErrorPanel message="No personnel ID provided." />
      </AdminPage>
    );
  }

  if (loading) return <AdminPage><PersonSkeleton /></AdminPage>;

  if (forbidden) {
    return (
      <AdminPage>
        <BackButton />
        <RestrictedNotice permission="VIEW_USER_PROFILE" />
      </AdminPage>
    );
  }
  if (notFound) {
    return (
      <AdminPage>
        <BackButton />
        <ErrorPanel message="Personnel record not found. It may have been removed." />
      </AdminPage>
    );
  }
  if (error || !data) {
    return (
      <AdminPage>
        <BackButton />
        <ErrorPanel message={error ?? "Unknown error"} onRetry={load} />
      </AdminPage>
    );
  }

  const p = data.profile;
  const trendData = [...data.riskTrend].reverse().map((t, i) => ({
    idx: i, level: t.level, color: LEVEL_META[t.level].dot, createdAt: t.createdAt,
  }));
  const activityData = [
    { label: "Assessments", count: data.assessments.length, color: "#1d256f" },
    { label: "Journals", count: data.journals.length, color: "#1d256f" },
    { label: "Voice", count: data.voiceEntries.length, color: "#1d256f" },
    { label: "AI chats", count: data.conversations.length, color: "#1d256f" },
  ];

  return (
    <AdminPage>
      <div className="admin-record-page">
      <BackButton />

      {/* Header */}
      <Card className="mb-6">
        <CardContent className="py-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4 min-w-0">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary">
                {(p.name?.[0] ?? "?").toUpperCase()}
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                  {p.name ?? "Unknown"}
                </h1>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {p.serviceNumber ?? "—"} · {p.rank ?? "—"} · {p.unit ?? "Unassigned"}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary" className="ring-1 ring-border">{ROLE_LABELS[p.role]}</Badge>
                  <StatusPill status={p.status} />
                  {p.onboardingComplete && (
                    <Badge variant="outline" className="ring-1 ring-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/30">
                      <BadgeCheck className="h-3 w-3" /> Onboarded
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground sm:flex sm:flex-col sm:items-end">
              <div className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> Last active <span className="font-medium text-foreground tabular-nums">{relTime(p.lastActiveAt)}</span></div>
              <div className="flex items-center gap-1.5"><Calendar className="h-3 w-3" /> Last login <span className="font-medium text-foreground tabular-nums">{relTime(p.lastLoginAt)}</span></div>
              <div className="flex items-center gap-1.5"><Calendar className="h-3 w-3" /> Joined <span className="font-medium text-foreground tabular-nums">{fmtDate(p.createdAt)}</span></div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Latest risk indicator + trend */}
          {data.visible.risk ? (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">Latest Wellbeing Indicator</CardTitle>
                  <RiskFootnote />
                </div>
              </CardHeader>
              <CardContent>
                {data.latestRisk ? (
                  <>
                    <div className="flex flex-wrap items-center gap-3">
                      <LevelPill level={data.latestRisk.level} size="md" />
                      <span className="text-sm text-muted-foreground">
                        Score <span className="font-semibold text-foreground tabular-nums">{Math.round(data.latestRisk.score)}/100</span>
                      </span>
                      <span className="text-sm text-muted-foreground">·</span>
                      <span className="text-sm text-muted-foreground">
                        Source <span className="font-medium text-foreground">{data.latestRisk.source}</span>
                      </span>
                      <span className="text-sm text-muted-foreground">·</span>
                      <span className="text-sm text-muted-foreground tabular-nums">{relTime(data.latestRisk.createdAt)}</span>
                    </div>
                    <Separator className="my-4" />
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Indicator trend · last {trendData.length} events
                      </p>
                      {trendData.length === 0 ? (
                        <p className="py-6 text-center text-sm text-muted-foreground">No indicator history.</p>
                      ) : (
                        <div className="h-32 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={trendData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                              <XAxis dataKey="idx" hide />
                              <Tooltip
                                cursor={{ fill: "oklch(0.5 0.05 178 / 0.06)" }}
                                contentStyle={{ borderRadius: 8, border: "1px solid oklch(0.91 0.01 170)", background: "oklch(1 0 0)", fontSize: 12 }}
                                formatter={(_v, _n, item: any) => {
                                  const d = item?.payload;
                                  return [LEVEL_META[d.level as WellbeingLevel].label, fmtDateTime(d.createdAt)];
                                }}
                              />
                              <Bar dataKey="idx" radius={[4, 4, 0, 0]} maxBarSize={18}>
                                {trendData.map((d, i) => (
                                  <Cell key={i} fill={d.color} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No wellbeing indicator recorded yet.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <RestrictedNotice permission="VIEW_RISK_INDICATOR" />
          )}

          {/* Alerts on this person */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Alerts</CardTitle>
              <CardDescription>
                Operational alerts raised for this personnel member.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.alerts.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No alerts on record.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {data.alerts.map((a) => (
                    <li key={a.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <LevelPill level={a.severity as unknown as WellbeingLevel} />
                        <StatusBadge status={a.status} />
                        <span className="ml-auto text-xs text-muted-foreground tabular-nums">{fmtDateTime(a.createdAt)}</span>
                      </div>
                      <p className="mt-1.5 text-sm text-foreground">{a.reason}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">Source: {a.source}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Support requests */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Support Requests</CardTitle>
              <CardDescription>
                Requests this member has submitted for support or resources.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.supportRequests.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No support requests.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {data.supportRequests.map((s) => (
                    <li key={s.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="ring-1 ring-border">
                          <LifeBuoy className="mr-1 h-3 w-3" /> {s.type}
                        </Badge>
                        <SupportStatusBadge status={s.status} />
                        <span className="ml-auto text-xs text-muted-foreground tabular-nums">{fmtDateTime(s.createdAt)}</span>
                      </div>
                      <p className="mt-1.5 text-sm text-foreground">{s.message}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Assessment history */}
          {data.visible.assessments ? (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">Assessment History</CardTitle>
                  <AuditedBadge />
                </div>
                <CardDescription>
                  Assessment results are clinical content — every read is recorded in the audit log.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.assessments.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No assessments completed.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                          <th className="py-2 pr-3 text-left font-medium">Date</th>
                          <th className="py-2 pr-3 text-left font-medium">Indicator</th>
                          <th className="py-2 pr-3 text-right font-medium">Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.assessments.map((a) => (
                          <tr key={a.id} className="border-b border-border last:border-0">
                            <td className="py-2.5 pr-3 tabular-nums">{fmtDate(a.completedAt)}</td>
                            <td className="py-2.5 pr-3">
                              {a.level ? <LevelDot level={a.level} /> : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="py-2.5 pr-3 text-right font-medium tabular-nums">
                              {a.normalizedScore != null ? `${Math.round(a.normalizedScore)}/100` : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <RestrictedNotice permission="VIEW_ASSESSMENT" />
          )}

          {/* Journals */}
          {data.visible.journals ? (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">Journal Entries</CardTitle>
                  <AuditedBadge />
                </div>
                <CardDescription>
                  Personal journal submissions. Highly sensitive — every read is recorded.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.journals.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No journal entries.</p>
                ) : (
                  <ul className="space-y-3">
                    {data.journals.map((j) => (
                      <li key={j.id} className="rounded-lg border border-border bg-muted/30 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {j.wellbeingLevel && <LevelPill level={j.wellbeingLevel} />}
                          {j.mood && (
                            <Badge variant="outline" className="ring-1 ring-border">Mood: {j.mood}</Badge>
                          )}
                          <Badge variant="outline" className="ring-1 ring-border">{j.status}</Badge>
                          <span className="ml-auto text-xs text-muted-foreground tabular-nums">{fmtDateTime(j.createdAt)}</span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{j.content}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ) : (
            <RestrictedNotice permission="VIEW_JOURNAL" />
          )}

          {/* Voice transcripts */}
          {data.visible.journals ? (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">Voice Transcripts</CardTitle>
                  <AuditedBadge />
                </div>
                <CardDescription>
                  Voice journal transcriptions. Marked as sensitive — access audited.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.voiceEntries.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No voice entries.</p>
                ) : (
                  <ul className="space-y-3">
                    {data.voiceEntries.map((v) => (
                      <li key={v.id} className="rounded-lg border border-border bg-muted/30 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="ring-1 ring-border">
                            <Mic className="mr-1 h-3 w-3" /> {Math.round(v.durationSec)}s
                          </Badge>
                          {v.wellbeingLevel && <LevelPill level={v.wellbeingLevel} />}
                          <span className="ml-auto text-xs text-muted-foreground tabular-nums">{fmtDateTime(v.createdAt)}</span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{v.transcript}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ) : null}

          {/* AI conversations */}
          {data.visible.conversations ? (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">AI Conversations</CardTitle>
                  <AuditedBadge />
                </div>
                <CardDescription>
                  AI companion chats. Sensitive — every read is recorded in the audit log.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.conversations.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No AI conversations.</p>
                ) : (
                  <ul className="space-y-4">
                    {data.conversations.map((c) => (
                      <li key={c.id} className="rounded-lg border border-border bg-muted/30 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-foreground">{c.title ?? "Untitled conversation"}</p>
                          <span className="text-xs text-muted-foreground tabular-nums">{fmtDateTime(c.createdAt)}</span>
                        </div>
                        <div className="mt-2 space-y-1.5">
                          {c.messages.map((m, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm">
                              <span className={`mt-0.5 inline-flex h-5 w-16 shrink-0 items-center justify-center rounded text-[10px] font-semibold uppercase tracking-wide ${m.role === "user" ? "bg-primary/10 text-primary" : m.role === "assistant" ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" : "bg-muted text-muted-foreground"}`}>
                                {m.role}
                              </span>
                              <p className="flex-1 whitespace-pre-wrap text-foreground">{m.content}</p>
                              {m.riskFlag && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-400/30">
                                  <TriangleAlert className="h-3 w-3" /> Risk
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ) : (
            <RestrictedNotice permission="VIEW_AI_CONVERSATION" />
          )}
        </div>

        {/* Right column — profile facts */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Profile & Status</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-y-3 text-sm">
                <dt className="text-muted-foreground">Service No.</dt>
                <dd className="text-right font-medium tabular-nums">{p.serviceNumber ?? "—"}</dd>
                <dt className="text-muted-foreground">Rank</dt>
                <dd className="text-right">{p.rank ?? "—"}</dd>
                <dt className="text-muted-foreground">Unit</dt>
                <dd className="text-right">{p.unit ?? "Unassigned"}</dd>
                <dt className="text-muted-foreground">Role</dt>
                <dd className="text-right">{ROLE_LABELS[p.role]}</dd>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="text-right"><StatusPill status={p.status} /></dd>
                <dt className="text-muted-foreground">Onboarding</dt>
                <dd className="text-right">{p.onboardingComplete ? "Complete" : "Pending"}</dd>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">At-a-glance</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2.5 text-sm">
                <Stat icon={ShieldAlert} label="Open alerts" value={String(data.alerts.filter(a => a.status !== "RESOLVED").length)} />
                <Stat icon={LifeBuoy} label="Open support" value={String(data.supportRequests.filter(s => s.status !== "RESOLVED").length)} />
                <Stat icon={ClipboardCheck} label="Assessments" value={String(data.assessments.length)} hideIf={!data.visible.assessments} />
                <Stat icon={BookHeart} label="Journals" value={String(data.journals.length)} hideIf={!data.visible.journals} />
                <Stat icon={Mic} label="Voice entries" value={String(data.voiceEntries.length)} hideIf={!data.visible.journals} />
                <Stat icon={MessageCircleHeart} label="Conversations" value={String(data.conversations.length)} hideIf={!data.visible.conversations} />
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Member Activity</CardTitle>
              <CardDescription>Saved wellbeing activity for this personnel member.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activityData} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: "#1d256f12" }} contentStyle={{ borderRadius: 8, border: "1px solid #1d256f33", background: "white", fontSize: 12 }} />
                    <Bar dataKey="count" fill="#1d256f" radius={[5, 5, 0, 0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      </div>
    </AdminPage>
  );
}

function StatusPill({ status }: { status: UserStatus }) {
  const map: Record<string, string> = {
    ACTIVE: "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/30",
    LOCKED: "bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-400/30",
    SUSPENDED: "bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/30",
    PENDING_VERIFICATION: "bg-sky-100 text-sky-700 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-400/30",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${map[status] ?? "bg-muted text-muted-foreground ring-border"}`}>
      {status.replace(/_/g, " ").toLowerCase()}
    </span>
  );
}

function Stat({ icon: Icon, label, value, hideIf }: { icon: typeof Mail; label: string; value: string; hideIf?: boolean }) {
  if (hideIf) return null;
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </span>
      <span className="font-semibold tabular-nums text-foreground">{value}</span>
    </li>
  );
}

function BackButton() {
  const { navigate } = useApp();
  return (
    <Button variant="ghost" size="sm" className="mb-4 -ml-2" onClick={() => navigate("admin-personnel")}>
      <ArrowLeft className="mr-2 h-4 w-4" /> Back to personnel
    </Button>
  );
}

function PersonSkeleton() {
  return (
    <>
      <Skeleton className="mb-4 h-4 w-32" />
      <Skeleton className="mb-6 h-32 w-full" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    </>
  );
}
