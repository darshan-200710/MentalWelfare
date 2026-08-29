"use client";

import {
  UserRound,
  ClipboardCheck,
  HeartPulse,
  BookHeart,
  MessageCircleHeart,
  Activity,
  LifeBuoy,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { PageHeader, SectionHeading } from "@/components/shared/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const steps = [
  {
    icon: UserRound,
    title: "Register",
    body: "Create your account using your service identity. Verify your email, set a strong password, and complete the consent step that explains exactly what you are and are not agreeing to.",
  },
  {
    icon: ClipboardCheck,
    title: "First assessment",
    body: "A short, validated baseline assessment calibrates CRPF MHS to you. This is not a diagnosis — it gives the platform a starting point against which later patterns make sense.",
  },
  {
    icon: HeartPulse,
    title: "Daily check-ins",
    body: "A 60-second pulse: mood, sleep, energy. Quick enough to do during a break, consistent enough to surface patterns over weeks.",
  },
  {
    icon: BookHeart,
    title: "Journaling (text & voice)",
    body: "Write when you can, speak when writing feels like too much. Voice entries are auto-transcribed. Your entries are private to you unless you escalate or a clinician is granted access.",
  },
  {
    icon: MessageCircleHeart,
    title: "AI-assisted companion",
    body: "A grounded companion for low-intensity moments — between check-ins, on exercises, late at night. It does not diagnose. It listens, reflects, and offers techniques from the resources library.",
  },
  {
    icon: Activity,
    title: "Internal monitoring",
    body: "CRPF MHS computes an operational wellbeing indicator from your check-ins, journals, and conversations. This is operational, not diagnostic — it helps the system decide when a discreet, supportive human check-in might help.",
  },
  {
    icon: LifeBuoy,
    title: "Human support escalation",
    body: "When patterns suggest it would help, CRPF MHS offers — never forces — a path to your unit wellbeing officer, a clinician, or chaplaincy. You always remain in control of when and how you ask for support.",
  },
];

const faqs = [
  {
    q: "Is the AI diagnosing me?",
    a: "No. CRPF MHS AI is an assistance tool, not a clinician. It summarises, reflects, and offers evidence-based techniques from the resources library. It does not assign diagnoses and must not be used as a substitute for professional assessment.",
  },
  {
    q: "Who sees my journals and conversations?",
    a: "By default, only you. Your raw journal content and AI conversations are treated as sensitive and are encrypted at rest with field-level protection. Access by supervisors, clinicians, or administrators requires elevated role permissions and is always written to the audit log.",
  },
  {
    q: "Is CRPF MHS anonymous?",
    a: "No — and it would be misleading to claim otherwise. CRPF MHS identifies you so it can route support to you when you ask for it, and so commanders and clinicians can see operational trends. What it does provide is granular consent, role-based access, and a complete audit trail so access is always traceable.",
  },
  {
    q: "What happens in a crisis?",
    a: "CRPF MHS is not an emergency service. If you are in immediate danger, contact your local emergency services. The platform surfaces emergency contacts prominently and offers a discreet path to your unit wellbeing officer or clinician. When high-risk signals are detected in your check-ins or journals, CRPF MHS will encourage you to reach out — and may, with your consent, help route that request.",
  },
  {
    q: "Can I withdraw consent later?",
    a: "Yes. Consent is granular and revocable per purpose. Withdrawing consent for a given use is recorded with a version so there is always a clear history of what you agreed to and when.",
  },
  {
    q: "Will my commander read my journal entries?",
    a: "No. Commanders and supervisors see operational indicators and trends at an aggregate level, not your raw journal content. Access to your raw content requires a sensitive-data permission that is granted only to roles with a genuine need (such as a treating clinician) and is always audit-logged.",
  },
];

export default function HowItWorksView() {
  const navigate = useApp((s) => s.navigate);

  return (
    <div className="bg-background">
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <PageHeader
          title="How CRPF MHS works"
          description="From registration to human support — seven steps, all designed around your privacy and your control."
        >
          <Button onClick={() => navigate("register")}>
            Get Started <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </PageHeader>

        {/* ------------------------------------------------------ VERTICAL STEPPER */}
        <div className="mt-12">
          <SectionHeading
            eyebrow="The process"
            title="Seven steps, end to end"
            description="Each step is built to be small, predictable, and revocable. You can pause at any point."
          />

          <ol className="mt-10 space-y-4">
            {steps.map((s, i) => (
              <li key={s.title}>
                <Card className="overflow-hidden">
                  <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:gap-5 sm:p-6">
                    <div className="flex items-center gap-3 sm:flex-col sm:items-center sm:gap-2">
                      <span className="relative inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                        {i + 1}
                      </span>
                      <s.icon className="h-5 w-5 text-muted-foreground sm:mt-0" />
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-foreground sm:text-lg">
                          {s.title}
                        </h3>
                        {i === 5 && (
                          <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                            Operational, not diagnostic
                          </Badge>
                        )}
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-[0.95rem]">
                        {s.body}
                      </p>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ol>
        </div>

        {/* ----------------------------------------------------------- FAQ */}
        <div className="mt-16 grid gap-10 lg:grid-cols-[1fr_1.5fr]">
          <div>
            <SectionHeading
              eyebrow="FAQ"
              title="Questions we hear often"
              description="Straight answers about privacy, the AI, and what happens in difficult moments."
            />
            <div className="mt-6">
              <Button variant="link" onClick={() => navigate("privacy")} className="px-0">
                Read the full privacy policy <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="pt-2">
              <Accordion type="single" collapsible className="w-full">
                {faqs.map((f, i) => (
                  <AccordionItem key={f.q} value={`item-${i}`}>
                    <AccordionTrigger className="text-left text-sm font-medium sm:text-base">
                      {f.q}
                    </AccordionTrigger>
                    <AccordionContent>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {f.a}
                      </p>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </div>

        {/* --------------------------------------------------------- CTA */}
        <div className="mt-14 rounded-xl border border-border bg-muted/30 p-6 sm:p-8">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                Ready to begin?
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Registration takes under two minutes. You can stop at any step.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => navigate("about")}>
                Learn more about CRPF MHS
              </Button>
              <Button onClick={() => navigate("register")}>
                Get Started <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
