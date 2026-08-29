"use client";

import { useCallback, useEffect, useState } from "react";
import {
  UserRound, ShieldCheck, KeyRound, Smartphone, History as HistoryIcon,
  BellRing, LockKeyhole, Database, CheckCircle2, XCircle, Loader2,
  RefreshCw, Mail, IdCard, Building2, Award, Clock, AlertTriangle,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { api, ApiRequestError } from "@/lib/api";
import { ROLE_LABELS, CONSENT_VERSION } from "@/lib/constants";
import type { ConsentDTO, Role, UserStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Spinner, EmptyState } from "@/components/shared/ui";
import { toast } from "sonner";

const STATUS_COLORS: Record<UserStatus, "default" | "secondary" | "destructive" | "outline"> = {
  ACTIVE: "default",
  LOCKED: "destructive",
  SUSPENDED: "destructive",
  PENDING_VERIFICATION: "secondary",
};

const CONSENT_PURPOSES: { key: ConsentDTO["purpose"]; title: string; desc: string }[] = [
  { key: "assessment", title: "Wellbeing check-ins", desc: "Allow analysis of your assessment responses." },
  { key: "journal_processing", title: "Journal analysis", desc: "Allow AI to analyze your journal entries for wellbeing signals." },
  { key: "voice_processing", title: "Voice transcription", desc: "Allow your voice notes to be transcribed and analyzed." },
  { key: "ai_processing", title: "AI Companion", desc: "Allow AI to process your chat messages." },
];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ProfileView() {
  const { user, navigate } = useApp();

  const [consents, setConsents] = useState<ConsentDTO[]>([]);
  const [loadingConsent, setLoadingConsent] = useState(true);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [busyPurpose, setBusyPurpose] = useState<string | null>(null);

  // Pending consent change confirmation
  const [pendingChange, setPendingChange] = useState<{ purpose: string; status: "GRANTED" | "WITHDRAWN" } | null>(null);

  const loadConsents = useCallback(async () => {
    setLoadingConsent(true); setConsentError(null);
    try {
      const r = await api.get<{ version: string; records: ConsentDTO[] }>("/api/consent");
      setConsents(r.records);
    } catch (e) {
      setConsentError(e instanceof ApiRequestError ? e.message : "Couldn't load consent records.");
    } finally { setLoadingConsent(false); }
  }, []);

  useEffect(() => {
    const loadId = window.setTimeout(() => { void loadConsents(); }, 0);
    return () => window.clearTimeout(loadId);
  }, [loadConsents]);

  function getStatus(purpose: string): "GRANTED" | "WITHDRAWN" | null {
    const rec = consents.find((c) => c.purpose === purpose);
    return rec?.status ?? null;
  }

  async function applyConsentChange() {
    if (!pendingChange) return;
    setBusyPurpose(pendingChange.purpose);
    try {
      await api.post("/api/consent", { purpose: pendingChange.purpose, status: pendingChange.status });
      toast.success(pendingChange.status === "GRANTED" ? "Consent granted." : "Consent withdrawn.");
      await loadConsents();
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? e.message : "Failed to update consent.");
    } finally {
      setBusyPurpose(null);
      setPendingChange(null);
    }
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6">
        <h1 className="serif text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Profile</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Your account details, security, and privacy preferences.</p>
      </div>

      {/* Identity card */}
      <Card className="border-border/60">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-semibold text-primary-foreground">
              {(user.name?.[0] ?? user.email[0]).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold text-foreground">{user.name ?? "—"}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant={STATUS_COLORS[user.status]}>
                  {user.status === "ACTIVE" ? "Active" : user.status.replace("_", " ").toLowerCase()}
                </Badge>
                <Badge variant="outline">{ROLE_LABELS[user.role as Role]}</Badge>
                {user.mfaEnabled && (
                  <Badge variant="secondary"><ShieldCheck className="mr-1 h-3 w-3" />MFA on</Badge>
                )}
              </div>
            </div>
          </div>

          <Separator className="my-5" />

          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <ProfileRow icon={IdCard} label="Service number" value={user.serviceNumber ?? "—"} />
            <ProfileRow icon={Building2} label="Unit" value={user.unit ?? "—"} />
            <ProfileRow icon={Award} label="Rank" value={user.rank ?? "—"} />
            <ProfileRow icon={Mail} label="Email" value={user.email} />
            <ProfileRow icon={Clock} label="Member since" value={fmtDate(user.createdAt)} />
            <ProfileRow icon={HistoryIcon} label="Last login" value={user.lastLoginAt ? fmtDateTime(user.lastLoginAt) : "—"} />
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
              <KeyRound className="h-4 w-4 text-primary" /> Password
            </CardTitle>
            <CardDescription className="text-xs">Change your sign-in password.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="cur-pw" className="text-xs">Current password</Label>
              <Input id="cur-pw" type="password" placeholder="••••••••" disabled />
            </div>
            <div>
              <Label htmlFor="new-pw" className="text-xs">New password</Label>
              <Input id="new-pw" type="password" placeholder="••••••••" disabled />
            </div>
            <div>
              <Label htmlFor="confirm-pw" className="text-xs">Confirm new password</Label>
              <Input id="confirm-pw" type="password" placeholder="••••••••" disabled />
            </div>
            <Button className="w-full" disabled>
              <LockKeyhole className="mr-1.5 h-4 w-4" /> Coming soon
            </Button>
            <p className="text-xs text-muted-foreground">Self-service password change is on the roadmap.</p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Smartphone className="h-4 w-4 text-primary" /> Multi-factor authentication
            </CardTitle>
            <CardDescription className="text-xs">Add an extra layer of security.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <div>
                <p className="text-sm font-medium text-foreground">Authenticator app</p>
                <p className="text-xs text-muted-foreground">{user.mfaEnabled ? "Configured" : "Not yet configured"}</p>
              </div>
              <Switch checked={user.mfaEnabled} disabled aria-label="MFA toggle" />
            </div>
            <Button variant="outline" className="w-full" disabled>
              {user.mfaEnabled ? "Reconfigure MFA" : "Enable MFA"} — Coming soon
            </Button>
            <p className="text-xs text-muted-foreground">MFA setup wizard is on the roadmap.</p>
          </CardContent>
        </Card>
      </div>

      {/* Sessions */}
      <Card className="mt-6 border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
            <HistoryIcon className="h-4 w-4 text-primary" /> Active sessions
          </CardTitle>
          <CardDescription className="text-xs">Devices currently signed in to your account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <SessionRow device="This device" location="Current session" current lastActive="Active now" />
          <p className="pt-1 text-xs text-muted-foreground">Session management is coming soon.</p>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="mt-6 border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
            <BellRing className="h-4 w-4 text-primary" /> Notification preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <ToggleRow label="Daily check-in reminders" desc="A gentle nudge to log your mood." defaultChecked />
          <ToggleRow label="AI Companion updates" desc="When new features are added." />
          <ToggleRow label="Support responses" desc="When your support request is updated." defaultChecked />
          <ToggleRow label="Wellbeing tips" desc="Occasional articles & resources." />
        </CardContent>
      </Card>

      {/* Data preferences */}
      <Card className="mt-6 border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Database className="h-4 w-4 text-primary" /> Data preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <ToggleRow label="Anonymous usage analytics" desc="Help us improve CRPF MHS — no personal data shared." />
          <ToggleRow label="Share de-identified insights with research" desc="Contribute to armed forces wellbeing research." />
        </CardContent>
      </Card>

      {/* Consent management */}
      <Card className="mt-6 border-border/60">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
                <ShieldCheck className="h-4 w-4 text-primary" /> Consent management
              </CardTitle>
              <CardDescription className="mt-1 text-xs">
                Review and manage what you've consented to. Current version: <strong>v{CONSENT_VERSION}</strong>
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={loadConsents} disabled={loadingConsent}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loadingConsent ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingConsent ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : consentError ? (
            <EmptyState icon={AlertTriangle} title="Couldn't load consent records" description={consentError}
              action={<Button onClick={loadConsents} variant="outline"><RefreshCw className="mr-2 h-4 w-4" />Retry</Button>} />
          ) : (
            <ul className="divide-y divide-border/60">
              {CONSENT_PURPOSES.map((p) => {
                const status = getStatus(p.key);
                const granted = status === "GRANTED";
                return (
                  <li key={p.key} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1 pr-3">
                      <p className="text-sm font-medium text-foreground">{p.title}</p>
                      <p className="text-xs text-muted-foreground">{p.desc}</p>
                      {status && (
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {status === "GRANTED" ? "Granted" : "Withdrawn"}
                          {consents.find((c) => c.purpose === p.key) && (
                            <> on {fmtDate(consents.find((c) => c.purpose === p.key)!.grantedAt)}</>
                          )}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {granted ? (
                        <Badge variant="outline" className="gap-1 text-emerald-700 dark:text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" /> Granted
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-muted-foreground">
                          <XCircle className="h-3 w-3" /> Not granted
                        </Badge>
                      )}
                      <Button
                        size="sm"
                        variant={granted ? "outline" : "default"}
                        disabled={busyPurpose === p.key}
                        onClick={() => setPendingChange({ purpose: p.key, status: granted ? "WITHDRAWN" : "GRANTED" })}
                      >
                        {busyPurpose === p.key && <Spinner className="mr-1.5 h-3.5 w-3.5" />}
                        {granted ? "Withdraw" : "Grant"}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 p-3">
            <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Withdrawing consent may limit some features (e.g., AI Companion, voice transcription).
              Existing data will continue to be handled in line with our privacy policy.
              <Button variant="link" size="sm" className="ml-1 h-auto p-0 text-xs" onClick={() => navigate("privacy")}>
                Read privacy policy
              </Button>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Consent history records */}
      {consents.length > 0 && (
        <Card className="mt-6 border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-foreground">Consent history</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border/60">
              {consents.map((c, i) => (
                <li key={i} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium text-foreground">{c.purpose.replace(/_/g, " ")}</p>
                    <p className="text-xs text-muted-foreground">v{c.version} · {fmtDateTime(c.grantedAt)}</p>
                  </div>
                  <Badge variant={c.status === "GRANTED" ? "default" : "secondary"} className="text-[10px]">
                    {c.status === "GRANTED" ? "Granted" : "Withdrawn"}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Confirm change */}
      <AlertDialog open={!!pendingChange} onOpenChange={(o) => !o && setPendingChange(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingChange?.status === "GRANTED" ? "Grant consent?" : "Withdraw consent?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingChange?.status === "GRANTED"
                ? "This will allow CRPF MHS to process your data for this purpose going forward."
                : "Withdrawing may disable some features. You can re-grant consent at any time."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!busyPurpose}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={applyConsentChange} disabled={!!busyPurpose}>
              {busyPurpose && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ProfileRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

function SessionRow({ device, location, current, lastActive }: { device: string; location: string; current?: boolean; lastActive: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
      <div className="flex items-center gap-2.5">
        <div className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Smartphone className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{device}{current && <span className="ml-1.5 text-[10px] text-primary">· Current</span>}</p>
          <p className="text-xs text-muted-foreground">{location}</p>
        </div>
      </div>
      <span className="text-xs text-muted-foreground">{lastActive}</span>
    </div>
  );
}

function ToggleRow({ label, desc, defaultChecked }: { label: string; desc: string; defaultChecked?: boolean }) {
  const [checked, setChecked] = useState(!!defaultChecked);
  return (
    <div className="flex items-center justify-between rounded-lg py-2">
      <div className="pr-3">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={setChecked} aria-label={label} />
    </div>
  );
}
