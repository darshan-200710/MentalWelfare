"use client";

import { useEffect, useState, useCallback } from "react";
import { useApp } from "@/lib/store";
import { api, ApiRequestError } from "@/lib/api";
import { toast } from "sonner";
import {
  Card, CardContent,
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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/shared/ui";
import { LevelPill } from "@/components/shared/level-pill";
import type { AlertDTO, AlertSeverity, AlertStatus, WellbeingLevel } from "@/lib/types";
import {
  AdminPage, ErrorPanel, PermissionNotice, StatusBadge, fmtDateTime, relTime,
} from "./_shared";
import {
  BellRing, MoreHorizontal, UserCheck, RefreshCw, CheckCircle2,
  Eye, AlertCircle, ChevronLeft, ChevronRight,
} from "lucide-react";

type Resp = {
  alerts: AlertDTO[]; total: number; page: number; pageSize: number; pages: number;
};

const STATUSES: AlertStatus[] = ["OPEN", "ACKNOWLEDGED", "IN_REVIEW", "RESOLVED"];
const SEVERITIES: AlertSeverity[] = ["LOW", "MODERATE", "HIGH", "CRITICAL"];
const PAGE_SIZE = 20;

export default function AdminAlertsView() {
  const { navigate, user } = useApp();
  const [status, setStatus] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null); setForbidden(false);
    try {
      const p = new URLSearchParams();
      p.set("page", String(page));
      p.set("pageSize", String(PAGE_SIZE));
      if (status !== "all") p.set("status", status);
      if (severity !== "all") p.set("severity", severity);
      const r = await api.get<{
        alerts: AlertDTO[];
        total?: number;
        page?: number;
        pageSize?: number;
        pages?: number;
      }>(`/api/admin/alerts?${p.toString()}`);
      setData({
        alerts: r.alerts ?? [],
        total: r.total ?? r.alerts?.length ?? 0,
        page: r.page ?? 1,
        pageSize: r.pageSize ?? r.alerts?.length ?? 0,
        pages: r.pages ?? 1,
      });
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setError(e instanceof Error ? e.message : "Failed to load alerts");
    } finally { setLoading(false); }
  }, [page, status, severity]);

  useEffect(() => { const id = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(id); }, [load]);
  useEffect(() => { const id = window.setTimeout(() => setPage(1), 0); return () => window.clearTimeout(id); }, [status, severity]);

  const updateAlert = useCallback(async (id: string, body: { status?: AlertStatus; assignedToId?: string | null }) => {
    setActingId(id);
    try {
      await api.put(`/api/admin/alerts/${id}`, body);
      toast.success("Alert updated", {
        description: body.status ? `Status set to ${body.status.replace(/_/g, " ").toLowerCase()}.`
          : "Alert assigned to you.",
      });
      await load();
    } catch (e) {
      toast.error("Update failed", {
        description: e instanceof Error ? e.message : "Unexpected error",
      });
    } finally { setActingId(null); }
  }, [load]);

  if (forbidden) {
    return (
      <AdminPage>
        <Header />
        <PermissionNotice permission="MANAGE_ALERTS" />
      </AdminPage>
    );
  }

  return (
    <AdminPage>
      <Header />

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger aria-label="Filter by status" className="w-[160px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ").toLowerCase()}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger aria-label="Filter by severity" className="w-[160px]">
                <SelectValue placeholder="All severities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All severities</SelectItem>
                {SEVERITIES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ").toLowerCase()}</SelectItem>)}
              </SelectContent>
            </Select>
            {(status !== "all" || severity !== "all") && (
              <Button variant="ghost" size="sm" onClick={() => { setStatus("all"); setSeverity("all"); }}>
                Clear
              </Button>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </CardContent>
      </Card>

      {/* Body */}
      {loading ? (
        <AlertsSkeleton />
      ) : error ? (
        <ErrorPanel message={error} onRetry={load} />
      ) : !data || data.alerts.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={BellRing}
              title="No alerts"
              description="No alerts match the selected filters."
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="hidden lg:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Personnel</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="max-w-xs">Reason</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Assignee</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.alerts.map((a) => (
                    <TableRow key={a.id} className={actingId === a.id ? "opacity-60" : ""}>
                      <TableCell>
                        <button
                          className="text-left"
                          onClick={() => navigate("admin-person", { id: a.userId })}
                        >
                          <div className="font-medium text-foreground hover:underline">{a.userName}</div>
                          <div className="text-xs text-muted-foreground">{a.userUnit ?? "Unassigned"}</div>
                        </button>
                      </TableCell>
                      <TableCell><LevelPill level={a.severity as unknown as WellbeingLevel} /></TableCell>
                      <TableCell><StatusBadge status={a.status} /></TableCell>
                      <TableCell className="max-w-xs text-sm text-muted-foreground">
                        <span className="line-clamp-2">{a.reason}</span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a.source}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {a.assignedTo ?? <span className="italic">Unassigned</span>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground tabular-nums">{relTime(a.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <RowActions
                          alert={a}
                          currentUserId={user?.id}
                          acting={actingId === a.id}
                          onAssign={() => updateAlert(a.id, { assignedToId: user?.id ?? "" })}
                          onStatus={(s) => updateAlert(a.id, { status: s })}
                          onView={() => navigate("admin-person", { id: a.userId })}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Mobile/tablet cards */}
          <div className="grid grid-cols-1 gap-3 lg:hidden">
            {data.alerts.map((a) => (
              <Card key={a.id} className={actingId === a.id ? "opacity-60" : ""}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-2">
                    <button className="text-left min-w-0" onClick={() => navigate("admin-person", { id: a.userId })}>
                      <p className="font-medium text-foreground hover:underline">{a.userName}</p>
                      <p className="text-xs text-muted-foreground">{a.userUnit ?? "Unassigned"} · {a.source}</p>
                    </button>
                    <LevelPill level={a.severity as unknown as WellbeingLevel} />
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <StatusBadge status={a.status} />
                    <span className="text-xs text-muted-foreground tabular-nums">{fmtDateTime(a.createdAt)}</span>
                  </div>
                  <p className="mt-2 text-sm text-foreground line-clamp-3">{a.reason}</p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      Assignee: {a.assignedTo ?? <span className="italic">Unassigned</span>}
                    </p>
                    <RowActions
                      alert={a}
                      currentUserId={user?.id}
                      acting={actingId === a.id}
                      onAssign={() => updateAlert(a.id, { assignedToId: user?.id ?? "" })}
                      onStatus={(s) => updateAlert(a.id, { status: s })}
                      onView={() => navigate("admin-person", { id: a.userId })}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-xs text-muted-foreground tabular-nums">
              Showing <span className="font-medium text-foreground">{data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1}</span>–
              <span className="font-medium text-foreground">{Math.min(data.page * data.pageSize, data.total)}</span> of{" "}
              <span className="font-medium text-foreground">{data.total.toLocaleString()}</span>
            </p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" disabled={data.page <= 1} onClick={() => setPage(data.page - 1)}>
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <span className="px-3 text-sm tabular-nums text-muted-foreground">
                Page {data.page} of {Math.max(1, data.pages)}
              </span>
              <Button variant="outline" size="sm" disabled={data.page >= data.pages} onClick={() => setPage(data.page + 1)}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </AdminPage>
  );
}

function RowActions({
  alert, currentUserId, acting, onAssign, onStatus, onView,
}: {
  alert: AlertDTO;
  currentUserId: string | undefined;
  acting: boolean;
  onAssign: () => void;
  onStatus: (s: AlertStatus) => void;
  onView: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" disabled={acting} aria-label="Alert actions">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem onClick={onView}>
          <Eye className="mr-2 h-4 w-4" /> View personnel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onAssign} disabled={!currentUserId}>
          <UserCheck className="mr-2 h-4 w-4" /> Assign to me
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs">Set status</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => onStatus("ACKNOWLEDGED")} disabled={alert.status === "ACKNOWLEDGED"}>
          <AlertCircle className="mr-2 h-4 w-4" /> Acknowledge
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onStatus("IN_REVIEW")} disabled={alert.status === "IN_REVIEW"}>
          <Eye className="mr-2 h-4 w-4" /> Mark in review
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onStatus("RESOLVED")} disabled={alert.status === "RESOLVED"}>
          <CheckCircle2 className="mr-2 h-4 w-4" /> Resolve
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Header() {
  return (
    <div className="mb-6 flex flex-col gap-1">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Triage queue</p>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        Alerts
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Acknowledge, assign, and resolve operational alerts. Every action is audit-logged.
      </p>
    </div>
  );
}

function AlertsSkeleton() {
  return (
    <Card>
      <CardContent className="p-0">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-border p-3 last:border-0">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-6 w-20" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
