"use client";

import {
  ShieldCheck,
  Lock,
  ScrollText,
  UserCheck,
  DatabaseZap,
  Eye,
  Clock,
  FileCheck2,
  HeartCrack,
  AlertTriangle,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { PageHeader } from "@/components/shared/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CONSENT_VERSION } from "@/lib/constants";

const sections = [
  {
    id: "what-we-collect",
    title: "What data we collect",
    body: (
      <div className="space-y-3">
        <p>
          CRPF MHS is designed to support armed forces and uniformed-service
          personnel. To do that, we collect the following categories of
          information:
        </p>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>
            <strong>Identity &amp; service profile.</strong> Name, email,
            service number, unit, and rank — enough to route support to the
            right person.
          </li>
          <li>
            <strong>Wellbeing data.</strong> Daily check-in responses,
            assessment results, mood entries, and journal content (text and
            voice).
          </li>
          <li>
            <strong>AI conversations.</strong> Messages exchanged with the
            AI-assisted companion. These are treated as sensitive content.
          </li>
          <li>
            <strong>Operational &amp; audit data.</strong> Login events,
            consent decisions, alerts, support requests, and access to
            sensitive records — all written to an audit log.
          </li>
          <li>
            <strong>Support requests.</strong> Any message you submit through
            the support request form, along with its status.
          </li>
        </ul>
      </div>
    ),
  },
  {
    id: "why-we-collect",
    title: "Why we collect it",
    body: (
      <div className="space-y-3">
        <p>
          Each category has a clear purpose:
        </p>
        <ul className="ml-5 list-disc space-y-1.5">
          <li><strong>Identity</strong> — to authenticate you and route support to the correct chain of care.</li>
          <li><strong>Wellbeing data</strong> — to compute operational wellbeing indicators, surface patterns over time, and inform low-intensity AI-assisted support.</li>
          <li><strong>AI conversations</strong> — to provide the companion experience and detect signals that suggest a human check-in might help.</li>
          <li><strong>Audit &amp; operational data</strong> — to enforce accountability, support investigations, and detect misuse.</li>
          <li><strong>Support requests</strong> — to action and track your requests for help.</li>
        </ul>
        <p>
          We do not sell personal data. We do not use personal data for advertising.
        </p>
      </div>
    ),
  },
  {
    id: "how-we-use",
    title: "How it is used",
    body: (
      <div className="space-y-3">
        <p>
          Your data is used to power the features you interact with —
          check-ins, journaling, the AI companion, history, and trends. Where
          AI models are involved (for example, journal summaries or
          conversational responses), they run on the platform's backend and
          never train external models.
        </p>
        <p>
          Aggregated, de-identified trends may be shown to commanders and
          supervisors at an operational level — for example, "unit-level
          wellbeing is stable this week." Raw journal content and AI
          conversations are <strong>never</strong> shown to commanders or
          supervisors.
        </p>
      </div>
    ),
  },
  {
    id: "who-can-access",
    title: "Who can access it",
    body: (
      <div className="space-y-3">
        <p>
          Access is governed by role-based access control (RBAC) on a strict
          least-privilege basis:
        </p>
        <ul className="ml-5 list-disc space-y-1.5">
          <li><strong>You</strong> can always see your own data.</li>
          <li><strong>Supervisors</strong> see operational indicators and trends — not raw journals or AI conversations.</li>
          <li><strong>Mental health professionals</strong> may access your raw journal entries and AI conversations, but only when granted elevated permission, and every access is audit-logged.</li>
          <li><strong>Administrators</strong> manage accounts and system configuration; they do not have routine access to clinical content.</li>
        </ul>
        <p>
          Every access to sensitive data is written to an immutable audit log,
          including who accessed what and when.
        </p>
      </div>
    ),
  },
  {
    id: "retention",
    title: "Retention",
    body: (
      <div className="space-y-3">
        <p>
          Retention periods are set by your deployment organization and
          reflect operational and regulatory requirements. In general:
        </p>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>Account data is retained while your account is active and for a defined period after deactivation.</li>
          <li>Wellbeing and journal content is retained according to your organization's data retention policy.</li>
          <li>Audit logs are retained for an extended period to support accountability and investigations.</li>
          <li>Support requests are retained until resolved and archived per policy.</li>
        </ul>
        <p>
          You can request deletion of your data in line with your organization's
          data subject rights process. Some records (such as audit logs) may be
          retained to meet legal obligations.
        </p>
      </div>
    ),
  },
  {
    id: "sensitive-data",
    title: "Sensitive data protection",
    body: (
      <div className="space-y-3">
        <p>
          Wellbeing content is inherently sensitive. CRPF MHS protects it
          with multiple layers:
        </p>
        <ul className="ml-5 list-disc space-y-1.5">
          <li><strong>Encryption at rest</strong> — sensitive fields are encrypted in the database, not just the database itself.</li>
          <li><strong>Field-level protection</strong> — journal content and AI conversation messages receive additional field-level protection.</li>
          <li><strong>Transport encryption</strong> — all traffic between your device and the platform is encrypted in transit.</li>
          <li><strong>Role-based access</strong> — sensitive content requires elevated permission that is granted on a need-to-know basis.</li>
          <li><strong>Audit logging</strong> — every access is recorded and reviewable.</li>
        </ul>
      </div>
    ),
  },
  {
    id: "consent",
    title: "Consent",
    body: (
      <div className="space-y-3">
        <p>
          Consent is granular, versioned, and revocable. When you register,
          you consent to the current version of this policy (v{CONSENT_VERSION}). Consent
          decisions are recorded with their version, so it is always clear what
          you agreed to and when.
        </p>
        <p>
          You can withdraw consent for specific purposes from your settings.
          Withdrawing consent does not automatically erase historical records
          (which may be subject to legal retention), but it stops new
          processing for the withdrawn purpose going forward.
        </p>
      </div>
    ),
  },
  {
    id: "your-rights",
    title: "Your rights",
    body: (
      <div className="space-y-3">
        <p>
          Depending on your jurisdiction, you may have the right to:
        </p>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>Access the personal data we hold about you.</li>
          <li>Request correction of inaccurate data.</li>
          <li>Request deletion of personal data, subject to legal retention obligations.</li>
          <li>Withdraw consent for specific processing purposes.</li>
          <li>Receive a copy of your data in a portable format.</li>
        </ul>
        <p>
          To exercise these rights, contact your unit administrator or the
          data protection contact configured by your deployment organization.
        </p>
      </div>
    ),
  },
];

const pillars = [
  { icon: Lock, title: "Encrypted at rest", body: "Database-level and field-level encryption for sensitive content." },
  { icon: ShieldCheck, title: "Least privilege", body: "Access only on a need-to-know basis, enforced by RBAC." },
  { icon: ScrollText, title: "Audit-logged", body: "Every sensitive action is recorded immutably." },
  { icon: UserCheck, title: "Consent-driven", body: "Granular, versioned, and revocable per purpose." },
];

export default function PrivacyView() {
  const navigate = useApp((s) => s.navigate);

  return (
    <div className="bg-background">
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <PageHeader
          title="Privacy & data protection"
              description="A clear, honest explanation of what CRPF MHS collects, why, who can see it, and the rights you have over your data."
        >
          <Button variant="outline" onClick={() => navigate("support")}>
            <HeartCrack className="mr-1.5 h-4 w-4" /> Need support?
          </Button>
        </PageHeader>

        {/* ---------------------------------------------- HONESTY DISCLAIMER */}
        <Card className="mt-8 border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/10">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
            <div className="text-sm leading-relaxed text-amber-900/90 dark:text-amber-100/80">
              <p className="font-semibold">CRPF MHS is not anonymous.</p>
              <p className="mt-1">
                The platform identifies you so it can route support to you when
                you ask for it, and so commanders and clinicians can see
                operational trends. What CRPF MHS provides is granular consent,
                strict role-based access, field-level encryption, and a complete
                audit trail — not anonymity.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* --------------------------------------------------- PILLAR OVERVIEW */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((p) => (
            <Card key={p.title} className="gap-0 py-4">
              <CardContent className="flex flex-col gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <p.icon className="h-4 w-4" />
                </span>
                <p className="text-sm font-semibold text-foreground">{p.title}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">{p.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ----------------------------------------------- POLICY ACCORDION */}
        <div className="mt-12 grid gap-10 lg:grid-cols-[260px_1fr]">
          {/* Sticky TOC */}
          <aside className="hidden lg:block">
            <nav aria-label="Privacy policy sections" className="sticky top-24 space-y-1">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Sections
              </p>
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="block rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {s.title}
                </a>
              ))}
            </nav>
          </aside>

          <div className="space-y-4">
            <Card className="border-border/70">
              <CardContent className="pt-2">
                <Accordion type="single" collapsible defaultValue="what-we-collect" className="w-full">
                  {sections.map((s, i) => (
                    <AccordionItem key={s.id} value={s.id}>
                      <AccordionTrigger
                        id={s.id}
                        className="text-left text-sm font-medium sm:text-base"
                      >
                        <span className="flex items-center gap-2">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {i + 1}
                          </span>
                          {s.title}
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3 pl-8 text-sm leading-relaxed text-muted-foreground">
                          {s.body}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>

            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/30 p-5">
              <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
                <FileCheck2 className="h-3 w-3" />
                Policy version: v{CONSENT_VERSION}
              </Badge>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> Last reviewed: {new Date().getFullYear()}
              </span>
              <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <DatabaseZap className="h-3.5 w-3.5" /> Encrypted, audit-logged, consent-tracked.
              </span>
            </div>

            <Card className="border-border/70 bg-muted/20">
              <CardContent className="flex flex-col items-start justify-between gap-4 py-5 sm:flex-row sm:items-center">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Eye className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Questions about your data?
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Contact your unit administrator or your organization's data protection contact.
                    </p>
                  </div>
                </div>
                <Button variant="outline" onClick={() => navigate("contact")}>
                  Contact us
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
