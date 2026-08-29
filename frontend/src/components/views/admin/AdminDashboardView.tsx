"use client";

import { useEffect, useState, useCallback } from "react";
import { useApp } from "@/lib/store";
import { api, ApiRequestError } from "@/lib/api";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { LevelDot, LevelPill } from "@/components/shared/level-pill";
import { hasPermission, LEVEL_META } from "@/lib/constants";
import type {
  AlertDTO, AlertSeverity, PersonnelRowDTO, WellbeingLevel,
} from "@/lib/types";
import {
  AdminPage, ErrorPanel, PermissionNotice, RiskFootnote,
  SkeletonCard, relTime,
} from "./_shared";
import {
  Users, Activity, ClipboardCheck, TriangleAlert, OctagonAlert,
  ShieldAlert, ArrowRight, ChevronRight, BellRing,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip,
  XAxis, YAxis,
} from "recharts";

type Cards = {
  totalPersonnel: number; activeUsers: number; assessmentsCompleted: number;
  elevatedIndicators: number; highIndicators: number; criticalAlerts: number;
};
type RiskRow = { level: WellbeingLevel; label: string; count: number; color: string };
type DashboardResp = { cards: Cards; riskDistribution: RiskRow[] };

type PersonnelListResp = {
  rows: PersonnelRowDTO[]; total: number; page: number; pageSize: number;
  pages: number; units: string[];
};
type AlertsListResp = { alerts: AlertDTO[]; total: number; page: number; pageSize: number; pages: number };

const STAT_CARDS: {
  key: keyof Cards; label: string; icon: typeof Users;
  tint: string; ring: string;
}[] = [
  { key: "totalPersonnel", label: "Total Personnel", icon: Users, tint: "bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300", ring: "ring-teal-200 dark:ring-teal-400/20" },
  { key: "activeUsers", label: "Active Users (7d)", icon: Activity, tint: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300", ring: "ring-emerald-200 dark:ring-emerald-400/20" },
  { key: "assessmentsCompleted", label: "Assessments Completed", icon: ClipboardCheck, tint: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300", ring: "ring-amber-200 dark:ring-amber-400/20" },
  { key: "elevatedIndicators", label: "Elevated Indicators", icon: TriangleAlert, tint: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300", ring: "ring-orange-200 dark:ring-orange-400/20" },
  { key: "highIndicators", label: "High Indicators", icon: OctagonAlert, tint: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300", ring: "ring-red-200 dark:ring-red-400/20" },
  { key: "criticalAlerts", label: "Critical Alerts", icon: ShieldAlert, tint: "bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-300", ring: "ring-rose-200 dark:ring-rose-400/20" },
];

export default function AdminDashboardView() {
  const { navigate, user } = useApp();
  const [dashboard, setDashboard] = useState<DashboardResp | null>(null);
  const [alertRows, setAlertRows] = useState<AlertDTO[]>([]);
  const [attn, setAttn] = useState<PersonnelRowDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const [dash, al, pHigh, pCrit] = await Promise.all([
        api.get<DashboardResp>("/api/admin/dashboard"),
        api.get<AlertsListResp>("/api/admin/alerts?pageSize=6").catch(() => null),
        api.get<PersonnelListResp>("/api/admin/personnel?level=HIGH&pageSize=5").catch(() => null),
        api.get<PersonnelListResp>("/api/admin/personnel?level=CRITICAL&pageSize=5").catch(() => null),
      ]);
      setDashboard(dash);
      setAlertRows(al?.alerts ?? []);
      const attn = [...(pHigh?.rows ?? []), ...(pCrit?.rows ?? [])]
        .sort((a, b) => (b.wellbeingLevel ?? "NORMAL").localeCompare(a.wellbeingLevel ?? "NORMAL"))
        .slice(0, 6);
      setAttn(attn);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) {
        setForbidden(true);
      } else {
        setError(e instanceof Error ? e.message : "Unexpected error");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { const id = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(id); }, [load]);

  const canAnalytics = user ? hasPermission(user.role, "VIEW_ANALYTICS") : false;

  if (loading) return <AdminPage><DashboardSkeleton /></AdminPage>;
  if (forbidden || !canAnalytics) {
    return (
      <AdminPage>
        <Header />
        <PermissionNotice permission="VIEW_ANALYTICS" />
      </AdminPage>
    );
  }
  if (error || !dashboard) {
    return (
      <AdminPage>
        <Header />
        <ErrorPanel message={error ?? "Could not load dashboard"} onRetry={load} />
      </AdminPage>
    );
  }

  const chartData = dashboard.riskDistribution.map((r) => ({
    name: r.label, count: r.count, color: r.color, level: r.level,
  }));

  return (
    <AdminPage>
      <Header />

      {/* Stat cards */}
      <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
        {STAT_CARDS.map((s) => {
          const Icon = s.icon;
          const val = dashboard.cards[s.key];
          return (
            <Card key={s.key} className="overflow-hidden">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ring-1 ${s.tint} ${s.ring}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums text-foreground">
                  {val.toLocaleString()}
                </p>
                <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                  {s.label}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Risk distribution chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Wellbeing Indicator Distribution</CardTitle>
            <CardDescription>
              Current operational indicator across all personnel
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.01 170 / 0.5)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: "oklch(0.5 0.05 178 / 0.06)" }}
                    contentStyle={{
                      borderRadius: 8, border: "1px solid oklch(0.91 0.01 170)",
                      background: "oklch(1 0 0)", fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={56}>
                    {chartData.map((d) => (
                      <Cell key={d.level} fill={d.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <RiskFootnote className="mt-3" />
          </CardContent>
        </Card>

        {/* Personnel requiring attention */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Personnel Requiring Attention</CardTitle>
              <Button
                variant="ghost" size="sm" className="h-7 px-2 text-xs"
                onClick={() => navigate("admin-personnel", { level: "HIGH" })}
              >
                View all <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
            <CardDescription>High or critical indicators</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {attn.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No personnel currently flagged. Calm waters.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {attn.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => navigate("admin-person", { id: p.id })}
                      className="flex w-full items-center justify-between gap-2 py-2.5 text-left transition-colors hover:bg-muted/40 -mx-2 px-2 rounded-md"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {p.name ?? "Unknown"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {p.unit ?? "Unassigned"}
                          {p.serviceNumber ? ` · ${p.serviceNumber}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {p.wellbeingLevel && <LevelDot level={p.wellbeingLevel} />}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent alerts table */}
      <Card className="mt-6">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Recent Alerts</CardTitle>
              <CardDescription>Most recent operational alerts across the platform</CardDescription>
            </div>
            <Button
              variant="outline" size="sm"
              onClick={() => navigate("admin-alerts")}
            >
              <BellRing className="mr-2 h-4 w-4" /> View alerts
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {alertRows.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No recent alerts.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Personnel</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead className="hidden md:table-cell">Reason</TableHead>
                    <TableHead className="hidden sm:table-cell">Source</TableHead>
                    <TableHead className="text-right">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alertRows.map((a) => (
                    <TableRow
                      key={a.id}
                      className="cursor-pointer"
                      onClick={() => navigate("admin-person", { id: a.userId })}
                    >
                      <TableCell>
                        <div className="font-medium text-foreground">{a.userName}</div>
                        <div className="text-xs text-muted-foreground">{a.userUnit ?? "Unassigned"}</div>
                      </TableCell>
                      <TableCell>
                        <LevelPill level={(a.severity as unknown as WellbeingLevel)} />
                      </TableCell>
                      <TableCell className="hidden max-w-xs truncate text-sm text-muted-foreground md:table-cell" title={a.reason}>
                        {a.reason}
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">{a.source}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                        {relTime(a.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </AdminPage>
  );
}

function Header() {
  return (
    <div className="mb-6 flex flex-col gap-1">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Operational overview</p>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        Admin Dashboard
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Real-time snapshot of personnel wellbeing indicators, alerts, and engagement across the platform.
      </p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <div className="mb-6 space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2"><CardContent><Skeleton className="h-72 w-full" /></CardContent></Card>
        <Card><CardContent><Skeleton className="h-72 w-full" /></CardContent></Card>
      </div>
    </>
  );
}
