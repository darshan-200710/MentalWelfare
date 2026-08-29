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
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/ui";
import type { AuditLogDTO } from "@/lib/types";
import { AUDIT_ACTIONS, AUDIT_ACTION_LABELS } from "@/lib/constants";

import {
  AdminPage, ErrorPanel, PermissionNotice, fmtDateTime,
} from "./_shared";
import {
  ScrollText, ChevronLeft, ChevronRight, RefreshCw, ChevronDown,
  ChevronRight as ChevR, LockKeyhole,
} from "lucide-react";

type Resp = {
  logs: AuditLogDTO[]; total: number; page: number; pageSize: number; pages: number;
};

const PAGE_SIZE = 40;
const COMMON_ACTIONS = Array.from(new Set(Object.values(AUDIT_ACTIONS))).sort();

const ACTION_TINT: Record<string, string> = {
  login: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  logout: "bg-muted text-muted-foreground",
  failed_login: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  password_reset: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  password_reset_request: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  sensitive_access: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  assessment_access: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  journal_access: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  conversation_access: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  alert_updated: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  alert_created: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  ai_safety_triggered: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  risk_event_created: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
};

function actionTint(action: string): string {
  return ACTION_TINT[action] ?? "bg-secondary text-secondary-foreground";
}

export default function AdminAuditView() {
  const [action, setAction] = useState("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null); setForbidden(false);
    try {
      const p = new URLSearchParams();
      p.set("page", String(page));
      p.set("pageSize", String(PAGE_SIZE));
      if (action !== "all") p.set("action", action);
      const r = await api.get<Resp>(`/api/admin/audit-logs?${p.toString()}`);
      setData(r);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setError(e instanceof Error ? e.message : "Failed to load audit logs");
    } finally { setLoading(false); }
  }, [page, action]);

  useEffect(() => { const id = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(id); }, [load]);
  useEffect(() => { const id = window.setTimeout(() => setPage(1), 0); return () => window.clearTimeout(id); }, [action]);

  if (forbidden) {
    return (
      <AdminPage>
        <Header />
        <PermissionNotice permission="VIEW_AUDIT_LOGS" />
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
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger aria-label="Filter by action" className="w-[220px]">
                <SelectValue placeholder="All actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {COMMON_ACTIONS.map((a) => <SelectItem key={a} value={a}>{a.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
            {action !== "all" && (
              <Button variant="ghost" size="sm" onClick={() => setAction("all")}>Clear</Button>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </CardContent>
      </Card>

      {loading ? (
        <AuditSkeleton />
      ) : error ? (
        <ErrorPanel message={error} onRetry={load} />
      ) : !data || data.logs.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState icon={ScrollText} title="No audit entries" description="No log entries match the selected filter." />
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead className="hidden md:table-cell">Target</TableHead>
                      <TableHead className="text-right">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.logs.map((log) => (
                      <AuditRow key={log.id} log={log} />
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

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

function AuditRow({ log }: { log: AuditLogDTO }) {
  const [open, setOpen] = useState(false);
  const hasMeta = log.metadata && Object.keys(log.metadata).length > 0;
  return (
    <>
      <TableRow className={open ? "bg-muted/20" : undefined}>
        <TableCell className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
          {fmtDateTime(log.createdAt)}
        </TableCell>
        <TableCell>
          <span className="text-sm font-medium text-foreground">{log.actorName ?? "system"}</span>
          {log.actorId && <span className="block text-xs text-muted-foreground tabular-nums">{log.actorId.slice(0, 8)}…</span>}
        </TableCell>
        <TableCell>
          <Badge variant="outline" className={`ring-1 ring-border ${actionTint(log.action)}`}>
            {log.action.replace(/_/g, " ")}
          </Badge>
        </TableCell>
        <TableCell className="hidden md:table-cell">
          <span className="text-sm text-muted-foreground">
            {log.targetType ?? "—"}
            {log.targetId && <span className="block text-xs tabular-nums">{log.targetId.slice(0, 8)}…</span>}
          </span>
        </TableCell>
        <TableCell className="text-right">
          {hasMeta ? (
            <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)}>
              <ChevR className={cn("mr-1 h-3 w-3 transition-transform", open && "rotate-90")} /> Details
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </TableCell>
      </TableRow>
      {hasMeta && open && (
        <TableRow className="border-b bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={5} className="py-3">
            <pre className="max-h-48 overflow-auto rounded-md bg-background p-3 text-xs text-muted-foreground calm-scroll">
              {JSON.stringify(log.metadata, null, 2)}
            </pre>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}


function Header() {
  return (
    <div className="mb-6 flex flex-col gap-1">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Compliance</p>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        Audit Logs
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        System audit log — sensitive actions are recorded here. Read-only.
      </p>
      <div className="mt-3 inline-flex w-fit items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-300">
        <LockKeyhole className="h-3.5 w-3.5" />
        <span>Every sensitive access (journals, assessments, conversations) is permanently recorded.</span>
      </div>
    </div>
  );
}

function AuditSkeleton() {
  return (
    <Card>
      <CardContent className="p-0">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-border p-3 last:border-0">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
