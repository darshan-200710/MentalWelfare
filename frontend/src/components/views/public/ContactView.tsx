"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Send,
  Mail,
  MessageSquare,
  Building2,
  LifeBuoy,
  CheckCircle2,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { PageHeader } from "@/components/shared/ui";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Spinner } from "@/components/shared/ui";

const schema = z.object({
  name: z.string().min(1, "Please enter your name").max(120, "That's a little long"),
  email: z.string().min(1, "Please enter your email").email("Enter a valid email address"),
  subject: z.string().min(1, "Please add a subject").max(200, "Subject is too long"),
  message: z
    .string()
    .min(10, "Please write a few more words so we can help")
    .max(5000, "Message is too long — please keep it under 5000 characters"),
});

type FormValues = z.infer<typeof schema>;

export default function ContactView() {
  const navigate = useApp((s) => s.navigate);
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", subject: "", message: "" },
  });

  const onSubmit = async (values: FormValues) => {
    // No email backend is wired in this build; simulate a successful submission.
    await new Promise((r) => setTimeout(r, 600));
    toast.success("Message received", {
      description: "Thank you for reaching out. We'll respond via email if needed.",
    });
    setSubmitted(true);
    reset();
  };

  return (
    <div className="bg-background">
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <PageHeader
          title="Contact"
          description="Questions about CRPF MHS, accessibility, or deploying it in your organization? Send us a message."
        />

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          {/* ----------------------------------------------------- FORM CARD */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Send a message</CardTitle>
              <CardDescription>
                Fields marked with <span className="text-destructive">*</span> are required.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {submitted ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    <CheckCircle2 className="h-6 w-6" />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold text-foreground">Message received</h3>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    Thanks for reaching out. We'll respond via email if needed.
                  </p>
                  <Button variant="outline" className="mt-6" onClick={() => setSubmitted(false)}>
                    Send another message
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="name">
                        Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="name"
                        autoComplete="name"
                        placeholder="Your full name"
                        aria-invalid={!!errors.name}
                        {...register("name")}
                      />
                      {errors.name && (
                        <p className="text-xs text-destructive">{errors.name.message}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="email">
                        Email <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        aria-invalid={!!errors.email}
                        {...register("email")}
                      />
                      {errors.email && (
                        <p className="text-xs text-destructive">{errors.email.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="subject">
                      Subject <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="subject"
                      placeholder="What is this about?"
                      aria-invalid={!!errors.subject}
                      {...register("subject")}
                    />
                    {errors.subject && (
                      <p className="text-xs text-destructive">{errors.subject.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="message">
                      Message <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id="message"
                      rows={6}
                      placeholder="Tell us how we can help…"
                      aria-invalid={!!errors.message}
                      {...register("message")}
                    />
                    {errors.message && (
                      <p className="text-xs text-destructive">{errors.message.message}</p>
                    )}
                  </div>

                  <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground">
                      This form is for general enquiries. For wellbeing support,{" "}
                      <button
                        type="button"
                        className="text-primary underline-offset-2 hover:underline"
                        onClick={() => navigate("support")}
                      >
                        visit the Support page
                      </button>
                      .
                    </p>
                    <Button type="submit" disabled={isSubmitting} className="shrink-0">
                      {isSubmitting ? (
                        <>
                          <Spinner className="mr-1.5" /> Sending…
                        </>
                      ) : (
                        <>
                          <Send className="mr-1.5 h-4 w-4" /> Send message
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          {/* --------------------------------------------------- SIDE INFO */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Building2 className="h-5 w-5" />
                </span>
                <CardTitle className="text-base">Organization</CardTitle>
                <CardDescription>
                  Configured by your deployment organization.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3 text-sm">
                  <div className="flex items-start gap-2.5">
                    <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <dt className="font-medium text-foreground">Email</dt>
                      <dd className="text-muted-foreground">Configured by your organization</dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <dt className="font-medium text-foreground">Internal helpdesk</dt>
                      <dd className="text-muted-foreground">Available via your unit directory</dd>
                    </div>
                  </div>
                </dl>
              </CardContent>
            </Card>

            <Card className="border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/10">
              <CardHeader>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                  <LifeBuoy className="h-5 w-5" />
                </span>
                <CardTitle className="text-base text-amber-900 dark:text-amber-200">
                  Need wellbeing support?
                </CardTitle>
                <CardDescription className="text-amber-800/80 dark:text-amber-100/70">
                  This contact form is for general enquiries and is not monitored 24/7.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-amber-900/90 dark:text-amber-100/80">
                  If you need wellbeing support, please use the dedicated Support
                  page — it lists confidential contacts and lets logged-in
                  personnel submit a tracked support request.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 border-amber-300 bg-background text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-950/40"
                  onClick={() => navigate("support")}
                >
                  Go to Support
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
