"use client";

import { useState } from "react";
import {
  LifeBuoy, BookOpen, UserRound, ShieldCheck, Mail, MessageSquare,
  ChevronRight, Clock, Search, HelpCircle, PhoneCall,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const FAQS: { q: string; a: string }[] = [
  {
    q: "Is my data private?",
    a: "Yes. Your journal entries, voice notes, conversations, and check-in responses are encrypted at rest and access-controlled. Only you can see your own data. Authorized mental-health professionals and supervisors may view sensitive entries, but every such access is recorded in an immutable audit log.",
  },
  {
    q: "Is the AI companion a real therapist?",
    a: "No. The AI companion is an AI-assisted support tool — it can listen, offer grounding techniques, and help you reflect. It is not a clinician and does not provide medical diagnoses or treatment. If you need clinical support, please reach out via the Support page or contact a qualified professional.",
  },
  {
    q: "What happens if I'm flagged for support?",
    a: "If our system detects signals suggesting you might benefit from extra support, a confidential, trained professional may reach out to check on you. This is support, not surveillance — and you are always in control of your data via the consent settings in your Profile.",
  },
  {
    q: "Can I delete my data?",
    a: "You can delete individual journal entries at any time. For full data deletion requests, please contact support — we'll process your request in line with applicable data-protection regulations.",
  },
  {
    q: "How is my wellbeing level calculated?",
    a: "CRPF MHS analyzes patterns in your journals, voice notes, and check-ins to produce an internal wellbeing indicator. This indicator is used to ensure timely support — it is never shown to you as a 'score', and only authorized roles can view aggregated indicators for oversight purposes.",
  },
  {
    q: "What should I do in a crisis?",
    a: "If you or someone else is in immediate danger, contact your local emergency services right away. CRPF MHS is not an emergency service. The Support page lists confidential 24/7 helplines for armed forces personnel and families.",
  },
  {
    q: "Can I use CRPF MHS anonymously?",
    a: "CRPF MHS is designed for verified armed-forces personnel, so accounts are tied to your service identity. However, your activity data is private to you, and you can withdraw consent for processing at any time from your Profile.",
  },
  {
    q: "Does it cost anything?",
    a: "CRPF MHS is provided as a wellbeing benefit to eligible armed forces personnel. There is no charge to use the platform.",
  },
];

const QUICK_LINKS = [
  { key: "resources", label: "Browse resources", desc: "Guides, articles & exercises", icon: BookOpen },
  { key: "support", label: "Get support", desc: "Talk to a person, confidentially", icon: LifeBuoy },
  { key: "profile", label: "Your profile", desc: "Account & privacy settings", icon: UserRound },
  { key: "privacy", label: "Privacy policy", desc: "How we handle your data", icon: ShieldCheck },
] as const;

const CONTACTS = [
  { label: "Confidential support line", desc: "24/7 for armed forces personnel", contact: "0800 000 0000", icon: PhoneCall, hours: "24/7" },
  { label: "Email CRPF MHS team", desc: "General questions & feedback", contact: "support@crpfmhs.example", icon: Mail, hours: "Replies within 2 working days" },
  { label: "Crisis text line", desc: "Text-based support", contact: "Text 'SUPPORT' to 85258", icon: MessageSquare, hours: "24/7" },
];

export default function HelpView() {
  const { navigate } = useApp();
  const [query, setQuery] = useState("");

  const filtered = FAQS.filter(
    (f) => f.q.toLowerCase().includes(query.toLowerCase()) || f.a.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6">
        <h1 className="serif text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Help & Support</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Quick answers, useful links, and ways to reach out.
        </p>
      </div>

      {/* Quick links */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {QUICK_LINKS.map((l) => (
          <button
            key={l.key}
            onClick={() => navigate(l.key as any)}
            className="group flex flex-col items-start gap-2 rounded-xl border border-border/60 bg-card p-4 text-left transition-all hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <l.icon className="h-4 w-4" />
            </span>
            <span className="text-sm font-medium text-foreground">{l.label}</span>
            <span className="text-xs text-muted-foreground">{l.desc}</span>
          </button>
        ))}
      </div>

      {/* FAQ */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
            <HelpCircle className="h-4 w-4 text-primary" /> Frequently asked questions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search FAQs…"
              className="pl-9"
              aria-label="Search FAQs"
            />
          </div>

          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No matches found. Try a different keyword or contact support.
            </p>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {filtered.map((f, i) => (
                <AccordionItem key={i} value={`item-${i}`}>
                  <AccordionTrigger className="text-left text-sm font-medium text-foreground hover:no-underline">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

      {/* Contact */}
      <Card className="mt-6 border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
            <LifeBuoy className="h-4 w-4 text-primary" /> Contact support
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {CONTACTS.map((c, i) => (
            <div key={i} className="flex items-start gap-3 rounded-lg border border-border/60 p-3.5">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <c.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{c.label}</p>
                <p className="text-xs text-muted-foreground">{c.desc}</p>
                <p className="mt-1 text-sm font-medium text-primary">{c.contact}</p>
              </div>
              <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground">
                <Clock className="h-3 w-3" /> {c.hours}
              </Badge>
            </div>
          ))}

          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">Prefer to write to us? Submit a confidential support request.</p>
            <Button onClick={() => navigate("support")} size="sm">
              <LifeBuoy className="mr-1.5 h-4 w-4" /> Open support
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
