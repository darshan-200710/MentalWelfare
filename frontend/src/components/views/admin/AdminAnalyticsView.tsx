"use client";

import { useEffect, useState, useCallback } from "react";
import { useApp } from "@/lib/store";
import { api, ApiRequestError } from "@/lib/api";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LEVEL_META } from "@/lib/constants";
import { hasPermission } from "@/lib/constants";
import type { WellbeingLevel } from "@/lib/types";
import {
  AdminPage, ErrorPanel, PermissionNotice, RiskFootnote,
} from "./_shared";
import {
  BarChart3, PieChart as PieIcon, Activity as ActivityIcon, TrendingUp,
  Users, ClipboardCheck, BookHeart, Mic, MessageCircleHeart,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

type RiskRow = { level: WellbeingLevel; label: string; count: number; color: string };
type UnitRow = { unit: string; total: number; elevated: number };
type ActivityRow = {
  date: string; journals: number; assessments: number; voice: number; chats: number;
};
type Resp = {
  riskDistribution: RiskRow[];
  units: UnitRow[];
  activity: ActivityRow[];
};

const ACTIVITY_SERIES: { key: keyof Omit<ActivityRow, "date">; label: string; color: string }[] = [
  { key: "journals", label: "Journals", color: "oklch(0.6 0.09 178)" },
  { key: "assessments", label: "Assessments", color: "oklch(0.7 0.12 145)" },
  { key: "voice", label: "Voice", color: "oklch(0.75 0.13 85)" },
  { key: "chats", label: "Chats", color: "oklch(0.68 0.17 55)" },
];

export default function AdminAnalyticsView() {
  const { user } = useApp();
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null); setForbidden(false);
    try {
      const r = await api.get<Resp>("/api/admin/analytics");
      setData(r);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setError(e instanceof Error ? e.message : "Failed to load analytics");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { const id = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(id); }, [load]);

  const canAnalytics = user ? hasPermission(user.role, "VIEW_ANALYTICS") : false;

  if (loading) return <AdminPage><AnalyticsSkeleton /></AdminPage>;
  if (forbidden || !canAnalytics) {
    return (
      <AdminPage>
        <Header />
        <PermissionNotice permission="VIEW_ANALYTICS" />
      </AdminPage>
    );
  }
  if (error || !data) {
    return (
      <AdminPage>
        <Header />
        <ErrorPanel message={error ?? "Could not load analytics"} onRetry={load} />
      </AdminPage>
    );
  }

  const total = data.riskDistribution.reduce((a, b) => a + b.count, 0);
  const elevatedPlus = data.riskDistribution
    .filter((d) => ["ELEVATED", "HIGH", "CRITICAL"].includes(d.level))
    .reduce((a, b) => a + b.count, 0);
  const totalActivity = data.activity.reduce(
    (acc, d) => ({ journals: acc.journals + d.journals, assessments: acc.assessments + d.assessments, voice: acc.voice + d.voice, chats: acc.chats + d.chats }),
    { journals: 0, assessments: 0, voice: 0, chats: 0 }
  );

  // For per-unit stacked bar: convert each unit into {unit, normal, elevated}
  const unitData = data.units
    .map((u) => ({ unit: u.unit, normal: u.total - u.elevated, elevated: u.elevated }))
    .sort((a, b) => b.normal + b.elevated - (a.normal + a.elevated));

  // For activity line: format date as MM-DD
  const activityData = data.activity.map((d) => ({ ...d, short: d.date.slice(5) }));

  return (
    <AdminPage>
      <Header />

      {/* Stat tiles */}
      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile icon={Users} label="Total personnel" value={total} tint="text-teal-700" />
        <StatTile icon={TrendingUp} label="Elevated or higher" value={elevatedPlus} tint="text-orange-700" />
        <StatTile icon={BookHeart} label="Journals (14d)" value={totalActivity.journals} tint="text-emerald-700" />
        <StatTile icon={ClipboardCheck} label="Assessments (14d)" value={totalActivity.assessments} tint="text-amber-700" />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Risk distribution donut */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Risk Distribution</CardTitle>
                <CardDescription>Latest wellbeing indicator across all personnel</CardDescription>
              </div>
              <PieIcon className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.riskDistribution}
                      dataKey="count" nameKey="label"
                      innerRadius={60} outerRadius={88} paddingAngle={2}
                    >
                        {data.riskDistribution.map((d) => (
                          <Cell key={d.level} fill={d.color} stroke="oklch(1 0 0)" />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ borderRadius: 8, border: "1px solid oklch(0.91 0.01 170)", background: "oklch(1 0 0)", fontSize: 12 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="space-y-1.5 text-xs">
                  {data.riskDistribution.map((d) => (
                    <li key={d.level} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                        {d.label}
                      </span>
                      <span className="font-medium tabular-nums text-foreground">{d.count.toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Per-unit stacked bar */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Per-unit Breakdown</CardTitle>
                  <CardDescription>Normal vs elevated-or-higher by unit</CardDescription>
                </div>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              {unitData.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">No unit data.</p>
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={unitData} margin={{ top: 4, right: 12, left: -16, bottom: 32 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.01 170 / 0.5)" vertical={false} />
                      <XAxis dataKey="unit" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} angle={-25} textAnchor="end" interval={0} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                      <Tooltip
                        cursor={{ fill: "oklch(0.5 0.05 178 / 0.06)" }}
                        contentStyle={{ borderRadius: 8, border: "1px solid oklch(0.91 0.01 170)", background: "oklch(1 0 0)", fontSize: 12 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="normal" name="Normal/Low/Moderate" stackId="a" fill="oklch(0.6 0.09 178)" radius={[0, 0, 0, 0]} maxBarSize={48} />
                      <Bar dataKey="elevated" name="Elevated+" stackId="a" fill="oklch(0.68 0.17 55)" radius={[4, 4, 0, 0]} maxBarSize={48} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity line chart */}
          <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Engagement Activity (14 days)</CardTitle>
                <CardDescription>Daily counts of journals, assessments, voice entries, and AI chats</CardDescription>
              </div>
              <ActivityIcon className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={activityData} margin={{ top: 4, right: 16, left: -16, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.01 170 / 0.5)" vertical={false} />
                  <XAxis dataKey="short" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={14} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid oklch(0.91 0.01 170)", background: "oklch(1 0 0)", fontSize: 12 }}
                    labelFormatter={(v: string) => v}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {ACTIVITY_SERIES.map((s) => (
                    <Line
                      key={s.key}
                      type="monotone"
                      dataKey={s.key}
                      name={s.label}
                      stroke={s.color}
                      strokeWidth={2}
                      dot={{ r: 2, fill: s.color }}
                      activeDot={{ r: 4 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <RiskFootnote className="mt-6" />
    </AdminPage>
  );
}

function StatTile({ icon: Icon, label, value, tint }: { icon: typeof Users; label: string; value: number; tint: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <Icon className={`h-5 w-5 ${tint}`} />
        </div>
        <p className={`mt-2 text-2xl font-semibold tabular-nums ${tint}`}>{value.toLocaleString()}</p>
        <p className="mt-0.5 text-xs font-medium text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function Header() {
  return (
    <div className="mb-6 flex flex-col gap-1">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Insights</p>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        Analytics
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Aggregate wellbeing indicators and engagement across the platform.
      </p>
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <>
      <div className="mb-6 space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}><CardContent><Skeleton className="h-20 w-full" /></CardContent></Card>
        ))}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card><CardContent><Skeleton className="h-72 w-full" /></CardContent></Card>
        <Card><CardContent><Skeleton className="h-72 w-full" /></CardContent></Card>
      </div>
    </>
  );
}
