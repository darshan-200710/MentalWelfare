"use client";

import {
  ShieldCheck,
  Target,
  Users,
  HeartHandshake,
  CheckCircle2,
  XCircle,
  Lock,
  ScrollText,
  UserCheck,
  ArrowRight,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { Logo } from "@/components/shared/logo";
import { PageHeader, SectionHeading } from "@/components/shared/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const principles = [
  {
    icon: Lock,
    title: "Least privilege",
    body: "Every role sees only what is necessary to perform their duty. Sensitive content requires explicit elevated permission and is always logged.",
  },
  {
    icon: UserCheck,
    title: "Explicit consent",
    body: "Users grant and withdraw consent per purpose. Every consent decision is recorded with a version, so it is always clear what was agreed to.",
  },
  {
    icon: ScrollText,
    title: "Audit logging",
    body: "Sensitive actions — viewing journals, escalating alerts, managing users — are written to an immutable audit trail.",
  },
  {
    icon: HeartHandshake,
    title: "Human escalation",
    body: "When the AI-assisted companion detects higher-risk signals, it does not diagnose — it discreetly connects you to a human.",
  },
];

const isWhat = [
  "A confidential check-in and journaling tool for service personnel.",
  "An AI-assisted companion for low-intensity, in-between moments.",
  "An operational wellbeing indicator that helps units notice patterns early.",
  "A discreet pathway to professional support, when you choose to ask for it.",
];

const isNotWhat = [
  "A clinical diagnostic tool. CRPF MHS does not diagnose mental illness.",
  "A replacement for clinicians, chaplains, or your unit wellbeing officer.",
  "An emergency service. In a crisis, contact local emergency services.",
  "Anonymous — your identity is known so we can route support to you.",
];

export default function AboutView() {
  const navigate = useApp((s) => s.navigate);

  return (
    <div className="bg-background">
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <PageHeader
          title="About CRPF MHS"
          description="A confidential, AI-assisted wellbeing and early-support platform — built for the realities of armed forces and uniformed-service life."
        >
          <Button variant="outline" onClick={() => navigate("how-it-works")}>
            How it works
          </Button>
        </PageHeader>

        {/* ------------------------------------------------------------- MISSION */}
        <div className="mt-12 grid gap-8 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <Badge variant="outline" className="w-fit border-primary/30 bg-primary/5 text-primary">
                <Target className="h-3 w-3" />
                Mission
              </Badge>
              <CardTitle className="mt-2 text-2xl">
                Help service personnel notice the early signs — and reach for support sooner.
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                CRPF MHS exists because wellbeing rarely breaks in a single
                dramatic moment — it wears down gradually, in sleepless nights,
                quiet disconnection, and small persistent stresses. By giving
                personnel a private way to check in, reflect, and ask for help,
                and by giving commanders and clinicians an operational view of
                trends (never raw content), CRPF MHS aims to catch problems
                earlier — without compromising trust or unit cohesion.
              </p>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
                CRPF MHS is not surveillance. It is a tool for the individual
                first, with carefully scoped, consent-based visibility for
                those whose duty is to support them.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Badge variant="outline" className="w-fit border-primary/30 bg-primary/5 text-primary">
                <Users className="h-3 w-3" />
                Who it's for
              </Badge>
              <CardTitle className="mt-2 text-base">Built around service life</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  Armed forces personnel (regular and reserve)
                </li>
                <li className="flex gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  Uniformed services — fire, emergency, corrections
                </li>
                <li className="flex gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  Commanders and supervisors supporting their teams
                </li>
                <li className="flex gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  Mental health professionals working with service populations
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* --------------------------------------------------------- IS / IS NOT */}
        <div className="mt-14">
          <SectionHeading
            eyebrow="Clarity first"
            title="What CRPF MHS is — and what it isn't"
            description="Mental wellbeing tools work best when expectations are honest. Here is where CRPF MHS stops, so you know exactly what you are using."
          />

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <Card className="border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/10">
              <CardHeader>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                  <CheckCircle2 className="h-5 w-5" />
                </span>
                <CardTitle className="text-lg text-emerald-900 dark:text-emerald-200">
                  CRPF MHS is
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {isWhat.map((w) => (
                    <li key={w} className="flex gap-2.5 text-sm text-emerald-900/90 dark:text-emerald-100/80">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="border-rose-200 bg-rose-50/40 dark:border-rose-900/40 dark:bg-rose-950/10">
              <CardHeader>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                  <XCircle className="h-5 w-5" />
                </span>
                <CardTitle className="text-lg text-rose-900 dark:text-rose-200">
                  CRPF MHS is not
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {isNotWhat.map((w) => (
                    <li key={w} className="flex gap-2.5 text-sm text-rose-900/90 dark:text-rose-100/80">
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* --------------------------------------------------------- PRINCIPLES */}
        <div className="mt-14">
          <SectionHeading
            eyebrow="Our commitment"
            title="Principles we do not compromise on"
            description="These principles guide every design and engineering decision in the platform."
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {principles.map((p) => (
              <Card key={p.title} className="h-full">
                <CardHeader>
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <p.icon className="h-4 w-4" />
                  </span>
                  <CardTitle className="text-sm">{p.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs leading-relaxed text-muted-foreground">{p.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Separator className="my-12" />

        {/* --------------------------------------------------------------- CTA */}
        <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-border bg-muted/30 p-6 sm:flex-row sm:items-center sm:p-8">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Logo size={24} />
            </span>
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Ready to see how it works?
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                A short walkthrough of what happens after you register.
              </p>
            </div>
          </div>
          <Button onClick={() => navigate("how-it-works")}>
            See the process <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </section>
    </div>
  );
}
