"use client";

import { useEffect, useState } from "react";
import {
  LifeBuoy,
  Phone,
  AlertTriangle,
  Clock,
  ShieldAlert,
  Send,
  RotateCw,
  Settings,
  HeartCrack,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { api, ApiRequestError } from "@/lib/api";
import type { EmergencyContactDTO, SupportStatus } from "@/lib/types";
import { PageHeader, EmptyState, Spinner } from "@/components/shared/ui";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

const SUPPORT_TYPES: { value: "general" | "counselling" | "urgent" | "peer"; label: string; description: string }[] = [
  { value: "general", label: "General wellbeing", description: "A general chat about how you're doing." },
  { value: "counselling", label: "Counselling", description: "Speak with a mental health professional." },
  { value: "urgent", label: "Urgent support", description: "You need to talk to someone soon." },
  { value: "peer", label: "Peer support", description: "Connect with a peer supporter." },
];

export default function SupportView() {
  const navigate = useApp((s) => s.navigate);
  const user = useApp((s) => s.user);
  const params = useApp((s) => s.params);

  const [contacts, setContacts] = useState<EmergencyContactDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inline support-request form state
  const [formOpen, setFormOpen] = useState(false);
  const [type, setType] = useState<"general" | "counselling" | "urgent" | "peer">("general");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastStatus, setLastStatus] = useState<SupportStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.get<{ contacts: EmergencyContactDTO[] }>(
          "/api/emergency-contacts"
        );
        if (!cancelled) setContacts(data.contacts ?? []);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof ApiRequestError
              ? e.message
              : "We couldn't load support contacts. Please try again."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const scrollToEmergency = () => {
    const el = document.getElementById("emergency-contact");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // If navigated with focus=emergency, scroll to the emergency card after data loads.
  useEffect(() => {
    if (params.focus === "emergency" && !loading) {
      const id = window.setTimeout(scrollToEmergency, 100);
      return () => window.clearTimeout(id);
    }
  }, [params.focus, loading]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) {
      toast.error("Please write a short message so we know how to help.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/api/support", { type, message: message.trim() });
      toast.success("Support request submitted.", {
        description: "A member of your support team will be in touch privately.",
      });
      setMessage("");
      setFormOpen(false);
      setLastStatus("OPEN");
    } catch (e) {
      const msg =
        e instanceof ApiRequestError ? e.message : "Something went wrong. Please try again.";
      toast.error("Couldn't submit your request", { description: msg });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-background">
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <PageHeader
          title="Support"
          description="Confidential pathways to the right people — within your unit and beyond. CRPF MHS does not replace emergency services."
        />

        {/* --------------------------------------- NEED IMMEDIATE HELP CARD */}
        <div className="mt-8 overflow-hidden rounded-xl border border-amber-200 bg-amber-50/70 dark:border-amber-900/40 dark:bg-amber-950/20">
          <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.4fr_1fr] lg:items-center">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                  <LifeBuoy className="h-5 w-5" />
                </span>
                <h2 className="text-xl font-semibold text-amber-900 dark:text-amber-200 sm:text-2xl">
                  Need immediate help?
                </h2>
              </div>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-amber-800/90 dark:text-amber-100/80">
                If you or someone else is in immediate danger, contact your
                local emergency services right now. CRPF MHS is not an
                emergency service — but the contacts below can help you reach
                the right support within your chain of care.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button
                  className="bg-amber-700 text-white hover:bg-amber-800"
                  onClick={scrollToEmergency}
                >
                  <Phone className="mr-1.5 h-4 w-4" /> Show emergency contacts
                </Button>
                <Button
                  variant="outline"
                  className="border-amber-300 bg-background text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-950/40"
                  onClick={() => navigate("resources")}
                >
                  See grounding resources
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-amber-200 bg-background/70 p-5 dark:border-amber-900/50 dark:bg-background/40">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                <ShieldAlert className="h-3.5 w-3.5" />
                If you are in immediate danger
              </p>
              <p className="mt-2 text-sm text-amber-900 dark:text-amber-100">
                Use your local emergency number, or go to the nearest emergency
                department. If you are with someone at immediate risk, do not
                leave them alone.
              </p>
            </div>
          </div>
        </div>

        {/* ---------------------------------------------- SUPPORT CONTACTS LIST */}
        <div className="mt-12">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-foreground sm:text-2xl">
                Support contacts
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Discreet points of contact for service personnel.
              </p>
            </div>
            {error && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setError(null);
                  setLoading(true);
                  api
                    .get<{ contacts: EmergencyContactDTO[] }>("/api/emergency-contacts")
                    .then((d) => setContacts(d.contacts ?? []))
                    .catch((e) =>
                      setError(e instanceof ApiRequestError ? e.message : "Failed to reload.")
                    )
                    .finally(() => setLoading(false));
                }}
              >
                <RotateCw className="h-3.5 w-3.5" /> Retry
              </Button>
            )}
          </div>

          {loading ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="gap-0 py-4">
                  <CardHeader>
                    <div className="h-5 w-32 rounded bg-muted" />
                    <div className="mt-2 h-4 w-2/3 rounded bg-muted/60" />
                  </CardHeader>
                  <CardContent>
                    <div className="h-4 w-full rounded bg-muted/50" />
                    <div className="mt-2 h-4 w-1/3 rounded bg-muted/50" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : error ? (
            <EmptyState
              icon={AlertTriangle}
              title="Couldn't load support contacts"
              description={error}
            />
          ) : contacts.length === 0 ? (
            <EmptyState
              icon={LifeBuoy}
              title="No support contacts configured"
              description="Support contact details are configured by your deployment organization. If you believe this is an error, contact your unit administrator."
            />
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {contacts.map((c) => {
                const isEmergency =
                  c.label.toLowerCase().includes("emergency") ||
                  (c.availableHours?.toLowerCase().includes("24/7") ?? false);
                return (
                  <div key={c.id} id={isEmergency ? "emergency-contact" : undefined}>
                    <Card
                      className={
                        isEmergency
                          ? "border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/10"
                          : ""
                      }
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className={
                              "inline-flex h-9 w-9 items-center justify-center rounded-lg " +
                              (isEmergency
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                                : "bg-primary/10 text-primary")
                            }
                          >
                            {isEmergency ? <ShieldAlert className="h-5 w-5" /> : <LifeBuoy className="h-5 w-5" />}
                          </span>
                          {c.availableHours && (
                            <Badge variant="outline" className="font-normal text-muted-foreground">
                              <Clock className="h-3 w-3" /> {c.availableHours}
                            </Badge>
                          )}
                        </div>
                        <CardTitle className="text-base">{c.label}</CardTitle>
                        <CardDescription className="text-sm leading-relaxed">
                          {c.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
                          <Phone className="h-4 w-4 shrink-0 text-primary" />
                          <span className="text-sm font-medium text-foreground">{c.contact}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>
          )}

          {/* Org-config note */}
          <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Settings className="h-3.5 w-3.5" />
            Support contact details are configured by your deployment organization.
          </p>
        </div>

        {/* ---------------------------------------------------- REQUEST SUPPORT */}
        <Separator className="my-12" />

        <div id="request-support" className="scroll-mt-24">
          <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <h2 className="text-xl font-semibold text-foreground sm:text-2xl">
                Request support privately
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                Use this form to discreetly request support from your unit
                wellbeing team or a clinician. Requests are routed through the
                platform and tracked — you'll see their status in your app.
              </p>

              <Card className="mt-6 border-primary/20 bg-primary/5">
                <CardContent className="flex items-start gap-3 py-4">
                  <HeartCrack className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      CRPF MHS is not a crisis service.
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      This form is not monitored 24/7 and is not a diagnosis tool.
                      If you are in immediate danger, contact your local emergency
                      services or use the contacts above.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {lastStatus && (
                <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                  Your last request is <span className="font-semibold">{lastStatus}</span>. A team member will be in touch.
                </p>
              )}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Support request</CardTitle>
                <CardDescription>
                  {user
                    ? "Tell us briefly what you need. You can be as vague or specific as you like."
                    : "Login or create an account to send a tracked support request."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!user ? (
                  <div className="flex flex-col gap-3 py-2">
                    <p className="text-sm text-muted-foreground">
                      Support requests are linked to your account so they can be
                      routed and tracked securely. You can browse the contacts
                      above without logging in.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => navigate("login")}>Login</Button>
                      <Button variant="outline" onClick={() => navigate("register")}>
                        Create account
                      </Button>
                    </div>
                  </div>
                ) : !formOpen ? (
                  <Button onClick={() => setFormOpen(true)}>
                    <Send className="mr-1.5 h-4 w-4" /> Request support
                  </Button>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="support-type">Type of support</Label>
                      <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                        <SelectTrigger id="support-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SUPPORT_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              <span className="font-medium">{t.label}</span>
                              <span className="ml-2 text-xs text-muted-foreground">
                                — {t.description}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="support-message">Message</Label>
                      <Textarea
                        id="support-message"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={5}
                        maxLength={2000}
                        placeholder="Briefly describe what you'd like support with. You don't have to share details you're not comfortable sharing."
                        aria-describedby="support-message-help"
                      />
                      <p id="support-message-help" className="text-xs text-muted-foreground">
                        Up to 2000 characters. This is treated as sensitive content and access is audit-logged.
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setFormOpen(false);
                          setMessage("");
                        }}
                        disabled={submitting}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={submitting}>
                        {submitting ? (
                          <>
                            <Spinner className="mr-1.5" /> Submitting…
                          </>
                        ) : (
                          <>
                            <Send className="mr-1.5 h-4 w-4" /> Submit request
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
