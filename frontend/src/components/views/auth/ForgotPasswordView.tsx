"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, CheckCircle2, Mail } from "lucide-react";
import { toast } from "sonner";

import { useApp } from "@/lib/store";
import { api } from "@/lib/api";

import { AuthShell } from "./AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const schema = z.object({
  email: z.string().min(1, "Enter your email").email("Enter a valid email address"),
});

type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordView() {
  const navigate = useApp((s) => s.navigate);
  const [submitting, setSubmitting] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [email, setEmail] = React.useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      await api.post("/api/auth/forgot-password", values);
    } catch (e) {
      // Intentionally ignore errors to prevent email enumeration
    }
    setSubmitting(false);
    setEmail(values.email);
    setSent(true);
    console.log("Reset request received");
  }

  const backButton = (
    <button
      type="button"
      onClick={() => navigate("login")}
      className="inline-flex items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
    >
      <ArrowLeft className="size-3.5" /> Back to sign in
    </button>
  );

  if (sent) {
    return (
      <AuthShell
        eyebrow="Check your inbox"
        title="Reset link sent"
        description="If an account exists for that email, a password reset link has been sent."
        footer={backButton}
      >
        <Alert className="border-primary/30 bg-primary/[0.04]">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <AlertTitle>Request received</AlertTitle>
          <AlertDescription className="text-sm text-muted-foreground">
            We&apos;ve sent a reset link to{" "}
            <span className="font-medium text-foreground">{email}</span>. The link
            will expire in 30 minutes. If you don&apos;t receive an email within a
            few minutes, check your spam folder or contact your unit&apos;s
            wellbeing officer.
          </AlertDescription>
        </Alert>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          In this development preview, outbound email is not wired. A real reset
          pipeline is enabled in production.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Forgot your password?"
      description="Enter your registered email and we'll send you a secure link to reset your password."
      footer={backButton}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Mail
                      className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                    <Input
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      placeholder="you@forces.gov"
                      className="pl-9"
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="h-10 w-full" disabled={submitting}>
            {submitting ? "Sending link…" : "Send reset link"}
          </Button>
        </form>
      </Form>
    </AuthShell>
  );
}
