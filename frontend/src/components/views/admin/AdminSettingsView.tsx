"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import { api, ApiRequestError } from "@/lib/api";
import { toast } from "sonner";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Check, X, ShieldCheck, Server, KeyRound, Database, RefreshCw } from "lucide-react";
import {
  AdminPage,
} from "./_shared";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  APP_NAME, APP_TAGLINE, CONSENT_VERSION, PERMISSIONS, PERMISSION_LABELS,
  ROLE_LABELS, SENSITIVE_PERMISSIONS,
} from "@/lib/constants";
import type { Permission, Role } from "@/lib/types";

const ROLES: Role[] = ["USER", "SUPERVISOR", "MENTAL_HEALTH_PROFESSIONAL", "ADMIN", "SUPER_ADMIN"];
const ALL_PERMISSIONS: Permission[] = [
  "VIEW_USER_PROFILE", "VIEW_RISK_INDICATOR", "VIEW_ASSESSMENT", "VIEW_JOURNAL",
  "VIEW_AI_CONVERSATION", "MANAGE_ALERTS", "MANAGE_USERS", "VIEW_ANALYTICS",
  "VIEW_AUDIT_LOGS", "MANAGE_SYSTEM",
];

export default function AdminSettingsView() {
  const { user } = useApp();
  const [seeding, setSeeding] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Best-effort: AI provider is server-only. We surface it only if explicitly
  // exposed via NEXT_PUBLIC_AI_PROVIDER; otherwise show that it's configured.
  const aiProvider = process.env.NEXT_PUBLIC_AI_PROVIDER ?? null;
  const isDev = process.env.NODE_ENV !== "production";

  const runSeed = async () => {
    setSeeding(true);
    setDialogOpen(false);
    try {
      const r = await api.post<{ users?: number; message?: string; [k: string]: unknown }>("/api/seed?force=1");
      toast.success("Seed data regenerated", {
        description: r && typeof r === "object"
          ? `${(r as any).users ?? "?"} users · ${(r as any).alerts ?? "?"} alerts`
          : "Database re-seeded.",
      });
    } catch (e) {
      const msg = e instanceof ApiRequestError
        ? (e.status === 403 ? "Seeding is disabled in production." : e.message)
        : e instanceof Error ? e.message : "Unknown error";
      toast.error("Seed failed", { description: msg });
    } finally {
      setSeeding(false);
    }
  };

  return (
    <AdminPage>
      <Header />

      {/* Top row: platform + environment */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Platform</CardTitle>
            <CardDescription>General application information</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-y-3 text-sm sm:grid-cols-2">
              <InfoRow icon={ShieldCheck} label="Application" value={APP_NAME} />
              <InfoRow label="Version" value="1.0.0" />
              <InfoRow label="Consent version" value={CONSENT_VERSION} />
              <InfoRow label="Tagline" value={APP_TAGLINE} full />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Environment</CardTitle>
            <CardDescription>
              Server-side configuration. Secrets are never exposed to the client.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-y-3 text-sm sm:grid-cols-2">
              <InfoRow
                icon={Server}
                label="Node env"
                value={
                  <Badge variant="outline" className={`ring-1 ${isDev ? "bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/30" : "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/30"}`}>
                    {process.env.NODE_ENV ?? "—"}
                  </Badge>
                }
              />
              <InfoRow
                icon={KeyRound}
                label="AI provider"
                value={
                  aiProvider ? (
                    <Badge variant="outline" className="ring-1 ring-border">{aiProvider}</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Server-configured (not exposed to client)
                    </span>
                  )
                }
              />
              <InfoRow
                icon={Database}
                label="Database"
                value={<Badge variant="outline" className="ring-1 ring-border">SQLite (Prisma)</Badge>}
              />
              <InfoRow label="Auth" value={<Badge variant="outline" className="ring-1 ring-border">Session cookie</Badge>} />
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* RBAC permission matrix */}
      <Card className="mt-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">RBAC Permission Matrix</CardTitle>
          <CardDescription>
            Role-based access control. Each row is a permission; columns are roles.
            Sensitive permissions (journals, conversations, assessments) are highlighted.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[240px]">Permission</TableHead>
                  {ROLES.map((r) => (
                    <TableHead key={r} className="text-center">{ROLE_LABELS[r]}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {ALL_PERMISSIONS.map((perm) => {
                  const isSensitive = SENSITIVE_PERMISSIONS.includes(perm);
                  return (
                    <TableRow key={perm} className={isSensitive ? "bg-amber-50/40 dark:bg-amber-500/5" : ""}>
                      <TableCell>
                        <div className="flex items-start gap-2">
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {PERMISSION_LABELS[perm]}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">{perm}</p>
                          </div>
                          {isSensitive && (
                            <Badge variant="outline" className="ring-1 ring-amber-200 bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/30">
                              Sensitive
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      {ROLES.map((r) => {
                        const granted = PERMISSIONS[r].includes(perm);
                        return (
                          <TableCell key={r} className="text-center">
                            {granted ? (
                              <Check className="inline-block h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <X className="inline-block h-4 w-4 text-muted-foreground/40" />
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="mt-6 border-amber-300/70 dark:border-amber-400/30">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-amber-700 dark:text-amber-300" />
            <CardTitle className="text-base">Development tools</CardTitle>
          </div>
          <CardDescription>
            These actions are intended for development &amp; staging only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Regenerate development seed data</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Truncates and re-seeds the SQLite database with synthetic personnel, journals, alerts, and audit logs.
                All existing data will be replaced. Audit-logged.
              </p>
              {!isDev && (
                <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-rose-700 dark:text-rose-300">
                  <X className="h-3 w-3" /> Disabled in production.
                </p>
              )}
            </div>
            <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="border-amber-300 text-amber-800 hover:bg-amber-50 dark:border-amber-400/40 dark:text-amber-300 dark:hover:bg-amber-500/10">
                  <RefreshCw className={`mr-2 h-4 w-4 ${seeding ? "animate-spin" : ""}`} />
                  Regenerate seed
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Regenerate seed data?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete and recreate all synthetic personnel, journals,
                    assessments, alerts, and audit logs in the connected database. This action
                    cannot be undone. Recommended only for development and staging environments.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => { e.preventDefault(); runSeed(); }}
                    className="bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-600 dark:hover:bg-amber-500"
                  >
                    Yes, regenerate
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      {/* Signed-in role summary */}
      {user && (
        <Card className="mt-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Your role</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground">
              You are signed in as <span className="font-semibold">{ROLE_LABELS[user.role]}</span>.
              You have{" "}
              <span className="font-semibold">{PERMISSIONS[user.role].length}</span> permission(s):
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PERMISSIONS[user.role].map((p) => (
                <Badge key={p} variant="outline" className="ring-1 ring-border">
                  {PERMISSION_LABELS[p]}
                </Badge>
              ))}
              {PERMISSIONS[user.role].length === 0 && (
                <span className="text-sm text-muted-foreground">No elevated permissions.</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </AdminPage>
  );
}

function InfoRow({
  icon: Icon, label, value, full,
}: {
  icon?: typeof Server; label: string; value: React.ReactNode; full?: boolean;
}) {
  return (
    <div className={`flex items-start justify-between gap-3 ${full ? "sm:col-span-2" : ""}`}>
      <dt className="flex items-center gap-2 text-sm text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </dt>
      <dd className="text-right text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

function Header() {
  return (
    <div className="mb-6 flex flex-col gap-1">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">System</p>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        Settings
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Platform information, environment, and the role-based permission matrix.
      </p>
    </div>
  );
}
