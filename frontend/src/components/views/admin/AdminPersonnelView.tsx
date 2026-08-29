"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useApp } from "@/lib/store";
import { api, ApiRequestError } from "@/lib/api";
import {
  Card, CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/ui";
import { LevelDot } from "@/components/shared/level-pill";
import { LEVEL_META } from "@/lib/constants";
import type { PersonnelRowDTO, WellbeingLevel } from "@/lib/types";
import { translate } from "@/lib/i18n";
import {
  AdminPage, ErrorPanel, PermissionNotice, relTime,
} from "./_shared";
import {
  Search, Users, ChevronLeft, ChevronRight, Filter,
  ChevronRight as ChevR,
} from "lucide-react";

type Resp = {
  rows: PersonnelRowDTO[]; total: number; page: number; pageSize: number;
  pages: number; units: string[];
};

const LEVELS: WellbeingLevel[] = ["NORMAL", "LOW", "MODERATE", "ELEVATED", "HIGH", "CRITICAL"];
const PAGE_SIZE = 12;

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-[#dfe7df] text-[#35604e] ring-[#aeb9ba]",
  LOCKED: "bg-[#eadfdd] text-[#7a3f3b] ring-[#c9aaa5]",
  SUSPENDED: "bg-[#eee6d2] text-[#765b28] ring-[#d5c39a]",
  PENDING_VERIFICATION: "bg-[#dfe5e8] text-[#3f5f70] ring-[#b4c2c8]",
};

export default function AdminPersonnelView() {
  const { navigate, params, language } = useApp();

  const [q, setQ] = useState(params.q ?? "");
  const [unit, setUnit] = useState(params.unit ?? "all");
  const [level, setLevel] = useState(params.level ?? "all");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  // Debounced search input
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedQ, setDebouncedQ] = useState(q);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQ(q);
      setPage(1);
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      if (debouncedQ.trim()) params.set("q", debouncedQ.trim());
      if (unit !== "all") params.set("unit", unit);
      if (level !== "all") params.set("level", level);
      const r = await api.get<Resp>(`/api/admin/personnel?${params.toString()}`);
      setData(r);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setError(e instanceof Error ? e.message : "Failed to load personnel");
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, unit, level, page]);

  useEffect(() => { const id = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(id); }, [load]);

  // Reset to page 1 when filters change
  useEffect(() => { const id = window.setTimeout(() => setPage(1), 0); return () => window.clearTimeout(id); }, [unit, level]);

  if (forbidden) {
    return (
      <AdminPage>
        <Header language={language} />
        <PermissionNotice permission="VIEW_USER_PROFILE" />
      </AdminPage>
    );
  }

  return (
    <AdminPage>
      <Header language={language} />

      {/* Filters */}
      <Card className="mb-4 rounded-none border-[#c9c1b3] bg-[#f7f3ea] shadow-none">
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={translate("Search by name, service number, or email…", language)}
              className="rounded-none border-[#c9c1b3] bg-[#fbf8f1] pl-9 shadow-none"
              aria-label={translate("Search personnel", language)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
              <FilterSelect
              value={unit} onChange={setUnit}
              placeholder={translate("All units", language)}
              items={(data?.units ?? []).map((u) => ({ value: u, label: u }))}
              ariaLabel={translate("Filter by unit", language)}
            />
            <FilterSelect
              value={level} onChange={setLevel}
              placeholder={translate("All levels", language)}
              items={LEVELS.map((l) => ({ value: l, label: LEVEL_META[l].label }))}
              ariaLabel={translate("Filter by wellbeing level", language)}
            />
            {(q || unit !== "all" || level !== "all") && (
              <Button
                variant="ghost" size="sm"
                onClick={() => { setQ(""); setUnit("all"); setLevel("all"); setPage(1); }}
              >
                {translate("Clear", language)}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Body */}
      {loading ? (
        <PersonnelSkeleton />
      ) : error ? (
        <ErrorPanel message={error} onRetry={load} />
      ) : !data || data.rows.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={Users}
              title="No personnel found"
              description="Try adjusting your search or filters."
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden rounded-none border-[#c9c1b3] bg-[#f7f3ea] shadow-none md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-serif text-foreground">{translate("Personnel", language)}</TableHead>
                    <TableHead className="font-serif text-foreground">{translate("Unit", language)}</TableHead>
                    <TableHead className="font-serif text-foreground">{translate("Status", language)}</TableHead>
                    <TableHead className="font-serif text-foreground">{translate("Wellbeing Indicator", language)}</TableHead>
                    <TableHead className="font-serif text-foreground">{translate("Last Check-in", language)}</TableHead>
                    <TableHead className="font-serif text-foreground">{translate("Last Activity", language)}</TableHead>
                    <TableHead className="font-serif text-foreground text-right">{translate("Actions", language)}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((p) => (
                    <TableRow key={p.id} className="border-[#d8d0c4] hover:bg-[#eee8dc]">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                            {(p.name?.[0] ?? "?").toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{p.name ?? "Unknown"}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {p.serviceNumber ?? "—"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{p.unit ?? "Unassigned"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`rounded-sm px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.08em] ring-1 ${STATUS_STYLE[p.status] ?? ""}`}>
                          {p.status.replace(/_/g, " ").toLowerCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {p.wellbeingLevel ? <LevelDot level={p.wellbeingLevel} /> : <span className="text-muted-foreground text-sm">—</span>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground tabular-nums">{relTime(p.lastCheckIn)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground tabular-nums">{relTime(p.lastActivity)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => navigate("admin-person", { id: p.id })}
                        >
                          {translate("View", language)} <ChevR className="ml-1 h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Mobile cards */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {data.rows.map((p) => (
              <Card key={p.id} className="rounded-none border-[#c9c1b3] bg-[#f7f3ea] shadow-none">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {(p.name?.[0] ?? "?").toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{p.name ?? "Unknown"}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {p.serviceNumber ?? "—"}
                        </p>
                      </div>
                    </div>
                    {p.wellbeingLevel && <LevelDot level={p.wellbeingLevel} />}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-y-1.5 text-xs">
                    <div className="text-muted-foreground">Unit</div>
                    <div className="text-right font-medium">{p.unit ?? "—"}</div>
                    <div className="text-muted-foreground">Status</div>
                    <div className="text-right">
                      <Badge variant="outline" className={`rounded-sm px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.08em] ring-1 ${STATUS_STYLE[p.status] ?? ""}`}>
                        {p.status.replace(/_/g, " ").toLowerCase()}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground">Last check-in</div>
                    <div className="text-right tabular-nums">{relTime(p.lastCheckIn)}</div>
                    <div className="text-muted-foreground">Last activity</div>
                    <div className="text-right tabular-nums">{relTime(p.lastActivity)}</div>
                  </div>
                  <Button
                    variant="outline" size="sm" className="mt-3 w-full"
                    onClick={() => navigate("admin-person", { id: p.id })}
                  >
                    {translate("View profile", language)}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          <Pagination
            page={data.page}
            pages={data.pages}
            total={data.total}
            pageSize={data.pageSize}
            onChange={setPage}
          />
        </>
      )}
    </AdminPage>
  );
}

function FilterSelect({
  value, onChange, placeholder, items, ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  items: { value: string; label: string }[];
  ariaLabel: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={ariaLabel} className="w-[160px] rounded-none border-[#c9c1b3] bg-[#fbf8f1] shadow-none">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{placeholder}</SelectItem>
        {items.map((it) => (
          <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Pagination({
  page, pages, total, pageSize, onChange,
}: {
  page: number; pages: number; total: number; pageSize: number;
  onChange: (p: number) => void;
}) {
  const language = useApp((s) => s.language);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-xs text-muted-foreground tabular-nums">
        {translate("Showing", language)} <span className="font-medium text-foreground">{from}</span>–
        <span className="font-medium text-foreground">{to}</span> of{" "}
        <span className="font-medium text-foreground">{total.toLocaleString()}</span>
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline" size="sm"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" /> Prev
        </Button>
        <span className="px-3 text-sm tabular-nums text-muted-foreground">
          {translate("Page", language)} {page} {translate("of", language)} {Math.max(1, pages)}
        </span>
        <Button
          variant="outline" size="sm"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
          aria-label="Next page"
        >
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function PersonnelSkeleton() {
  return (
    <Card>
      <CardContent className="p-0">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-border p-3 last:border-0">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-6 w-20" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function Header({ language }: { language: "en" | "hi" }) {
  return (
    <div className="mb-6 flex flex-col gap-1">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{translate("Directory", language)}</p>
      <h1 className="font-serif text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {translate("Personnel", language)}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {translate("Search and review operational records. Sensitive clinical content is restricted to authorized roles.", language)}
      </p>
    </div>
  );
}
