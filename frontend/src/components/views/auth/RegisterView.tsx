"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, ShieldCheck, User } from "lucide-react";
import { toast } from "sonner";

import { api, ApiRequestError } from "@/lib/api";
import { useApp } from "@/lib/store";
import type { SafeUser } from "@/lib/types";

import { AuthShell, PasswordInput, PasswordStrength } from "./AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const schema = z.object({
  name: z.string().min(2, "Enter your full name"),
  email: z.string().min(1, "Enter your email").email("Enter a valid email address"),
  password: z.string().min(8, "Use at least 8 characters"),
  serviceNumber: z.string().optional(),
  unit: z.string().optional(),
  rank: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function RegisterView() {
  const navigate = useApp((s) => s.navigate);
  const setUser = useApp((s) => s.setUser);

  const [submitting, setSubmitting] = React.useState(false);
  const [pw, setPw] = React.useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      serviceNumber: "",
      unit: "",
      rank: "",
    },
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const { user } = await api.post<{ user: SafeUser }>("/api/auth/register", {
        email: values.email,
        password: values.password,
        name: values.name,
        serviceNumber: values.serviceNumber || undefined,
        unit: values.unit || undefined,
        rank: values.rank || undefined,
      });
      setUser(user);
      toast.success("Account created. Let's get you set up.");
      navigate("assessment");
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (err.status === 409 || err.code === "EMAIL_TAKEN") {
          form.setError("email", {
            message: "An account with this email already exists.",
          });
        } else {
          toast.error(err.message || "Unable to create account. Please try again.");
        }
      } else {
        toast.error("Network error — please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Create your account"
      title="Join CRPF MHS"
      description="A confidential space to monitor, reflect on, and support your mental wellbeing."
      footer={
        <p>
          Already have an account?{" "}
          <button
            type="button"
            onClick={() => navigate("login")}
            className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
          >
            Sign in
          </button>
        </p>
      }
    >
      <Alert className="mb-5 border-primary/30 bg-primary/[0.04]">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <AlertDescription className="text-xs text-foreground/80">
          By creating an account, you consent to CRPF MHS processing your wellbeing
          data to provide personalised support. Entries are confidential and access
          is restricted. Read our{" "}
          <button
            type="button"
            onClick={() => navigate("privacy")}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            privacy policy
          </button>
          .
        </AlertDescription>
      </Alert>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full name</FormLabel>
                <FormControl>
                  <div className="relative">
                    <User
                      className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                    <Input
                      placeholder="Sgt. Jane Doe"
                      autoComplete="name"
                      className="pl-9"
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

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

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <PasswordInput
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    aria-invalid={!!form.formState.errors.password}
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      setPw(e.target.value);
                    }}
                  />
                </FormControl>
                <FormDescription className="sr-only">
                  Password strength indicator
                </FormDescription>
                <PasswordStrength password={pw} />
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <FormField
              control={form.control}
              name="serviceNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Service no.{" "}
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="12345678" autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="rank"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Rank{" "}
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Sergeant" autoComplete="organization-title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="unit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Unit{" "}
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="2 Bn" autoComplete="organization" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Button type="submit" className="h-10 w-full" disabled={submitting}>
            {submitting ? "Creating account…" : "Create account"}
          </Button>
        </form>
      </Form>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        What you&apos;re signing up for: self-guided check-ins, AI-assisted
        reflection, and confidential support pathways.
      </p>
    </AuthShell>
  );
}
