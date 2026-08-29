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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/ui";
import { LevelPill } from "@/components/shared/level-pill";
import { LEVEL_META } from "@/lib/constants";
import type { AlertDTO, WellbeingLevel } from "@/lib/types";
import {
  AdminPage, ErrorPanel, PermissionNotice, RiskFootnote, StatusBadge, fmtDate, relTime,
} from "./_shared";
import { ShieldAlert, Filter, BellRing, TrendingUp, ChevronRight } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";

type RiskRow = { level: WellbeingLevel; label: string; count: number; color: string };
type TrendRow = { date: string; count: number };
type Resp = {
  distribution: RiskRow[];
  trend: TrendRow[];
  recentAlerts: AlertDTO[];
};
type PersonnelUnitsResp = { units: string[] };

const LEVELS: WellbeingLevel[] = ["NORMAL", "LOW", "MODERATE", "ELEVATED", "HIGH", "CRITICAL"];
const DAY_OPTIONS = [7, 14, 30, 60, 90];

export default function AdminRiskView() {
  const { navigate } = useApp();
  const [unit, setUnit] = useState("all");
  const [level, setLevel] = useState("all");
  const [days, setDays] = useState(30);
  const [units, setUnits] = useState<string[]>([]);

  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  // Fetch units once (via personnel directory's returned units list)
  useEffect(() => {
    api.get<PersonnelUnitsResp>("/api/admin/personnel?pageSize=1")
      .then((r) => setUnits(r.units))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError(null); setForbidden(false);
    try {
      const p = new URLSearchParams();
      p.set("days", String(days));
      if (unit !== "all") p.set("unit", unit);
      if (level !== "all") p.set("level", level);
      const r = await api.get<Resp>(`/api/admin/risk?${p.toString()}`);
      setData(r);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setError(e instanceof Error ? e.message : "Failed to load risk data");
    } finally { setLoading(false); }
  }, [days, unit, level]);

  useEffect(() => { const id = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(id); }, [load]);

  if (forbidden) {
    return (
      <AdminPage>
        <Header />
        <PermissionNotice permission="VIEW_RISK_INDICATOR" />
      </AdminPage>
    );
  }

  const total = data?.distribution.reduce((a, b) => a + b.count, 0) ?? 0;
  const elevatedPlus = data?.distribution
    .filter((d) => ["ELEVATED", "HIGH", "CRITICAL"].includes(d.level))
    .reduce((a, b) => a + b.count, 0) ?? 0;

  return (
    <AdminPage>
      <Header />

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" />
            <span>Filters</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={unit} onValueChange={setUnit}>
              <SelectTrigger aria-label="Filter by unit" className="w-[160px]">
                <SelectValue placeholder="All units" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All units</SelectItem>
                {units.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger aria-label="Filter by level" className="w-[160px]">
                <SelectValue placeholder="All levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All levels</SelectItem>
                {LEVELS.map((l) => <SelectItem key={l} value={l}>{LEVEL_META[l].label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
              <SelectTrigger aria-label="Time window" className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAY_OPTIONS.map((d) => <SelectItem key={d} value={String(d)}>Last {d} days</SelectItem>)}
              </SelectContent>
            </Select>
            {(unit !== "all" || level !== "all") && (
              <Button variant="ghost" size="sm" onClick={() => { setUnit("all"); setLevel("all"); }}>
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary tiles */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryTile label="Personnel in view" value={total} tint="text-teal-700" />
        <SummaryTile label="Elevated or higher" value={elevatedPlus} tint="text-orange-700" />
        <SummaryTile
          label="High"
          value={data?.distribution.find((d) => d.level === "HIGH")?.count ?? 0}
          tint="text-red-700"
        />
        <SummaryTile
          label="Critical"
          value={data?.distribution.find((d) => d.level === "CRITICAL")?.count ?? 0}
          tint="text-rose-800"
        />
      </div>

      {loading ? (
        <RiskSkeleton />
      ) : error ? (
        <ErrorPanel message={error} onRetry={load} />
      ) : !data ? null : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Distribution horizontal bar chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Indicator Distribution</CardTitle>
              <CardDescription>Current wellbeing indicator levels (operational)</CardDescription>
            </CardHeader>
            <CardContent>
              {total === 0 ? (
                <EmptyState title="No data" description="No personnel match the selected filters." />
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.distribution} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.01 170 / 0.5)" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="label" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={70} />
                      <Tooltip
                        cursor={{ fill: "oklch(0.5 0.05 178 / 0.06)" }}
                        contentStyle={{ borderRadius: 8, border: "1px solid oklch(0.91 0.01 170)", background: "oklch(1 0 0)", fontSize: 12 }}
                      />
                      <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={28}>
                        {data.distribution.map((d) => <Cell key={d.level} fill={d.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              <RiskFootnote className="mt-3" />
            </CardContent>
          </Card>

          {/* Trend line chart */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Alert Trend</CardTitle>
                  <CardDescription>Alerts raised per day (last {days} days)</CardDescription>
                </div>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.trend} margin={{ top: 4, right: 12, left: -16, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.01 170 / 0.5)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
                      tickFormatter={(v: string) => v.slice(5)}
                      minTickGap={28}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: "1px solid oklch(0.91 0.01 170)", background: "oklch(1 0 0)", fontSize: 12 }}
                      labelFormatter={(v: string) => fmtDate(v)}
                    />
                    <Line
                      type="monotone" dataKey="count" stroke="oklch(0.42 0.05 178)"
                      strokeWidth={2} dot={{ r: 2, fill: "oklch(0.42 0.05 178)" }}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent alerts table */}
      <Card className="mt-6">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Recent Alerts</CardTitle>
              <CardDescription>Most recent operational alerts in the filtered scope</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("admin-alerts")}>
              <BellRing className="mr-2 h-4 w-4" /> View all
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {!data || data.recentAlerts.length === 0 ? (
            <EmptyState icon={ShieldAlert} title="No alerts" description="No alerts recorded in the selected scope." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Personnel</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Reason</TableHead>
                    <TableHead className="hidden sm:table-cell">Source</TableHead>
                    <TableHead className="text-right">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentAlerts.map((a) => (
                    <TableRow
                      key={a.id}
                      className="cursor-pointer"
                      onClick={() => navigate("admin-person", { id: a.userId })}
                    >
                      <TableCell>
                        <div className="font-medium text-foreground">{a.userName}</div>
                        <div className="text-xs text-muted-foreground">{a.userUnit ?? "Unassigned"}</div>
                      </TableCell>
                      <TableCell><LevelPill level={a.severity as unknown as WellbeingLevel} /></TableCell>
                      <TableCell><StatusBadge status={a.status} /></TableCell>
                      <TableCell className="hidden max-w-xs truncate text-sm text-muted-foreground md:table-cell" title={a.reason}>
                        {a.reason}
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">{a.source}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground tabular-nums">{relTime(a.createdAt)}</TableCell>
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

function SummaryTile({ label, value, tint }: { label: string; value: number; tint: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className={`text-2xl font-semibold tabular-nums ${tint}`}>{value.toLocaleString()}</p>
        <p className="mt-0.5 text-xs font-medium text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function Header() {
  return (
    <div className="mb-6 flex flex-col gap-1">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Operational monitoring</p>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        Risk Monitoring
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Snapshot of wellbeing indicators across personnel. Filter by unit, level, and time window.
      </p>
    </div>
  );
}

function RiskSkeleton() {
  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card><CardContent><Skeleton className="h-72 w-full" /></CardContent></Card>
        <Card><CardContent><Skeleton className="h-72 w-full" /></CardContent></Card>
      </div>
    </>
  );
}
