"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LockKeyhole } from "lucide-react";
import { toast } from "sonner";

import { api, ApiRequestError } from "@/lib/api";
import { useApp } from "@/lib/store";
import type { SafeUser } from "@/lib/types";

import { AuthShell, PasswordInput } from "./AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
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
  password: z.string().min(1, "Enter your password"),
  remember: z.boolean().default(false),
});

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

export default function LoginView() {
  const navigate = useApp((s) => s.navigate);
  const setUser = useApp((s) => s.setUser);

  const [submitting, setSubmitting] = React.useState(false);
  const [lockedMsg, setLockedMsg] = React.useState<string | null>(null);

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", remember: false },
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    setLockedMsg(null);
    try {
      const { user } = await api.post<{ user: SafeUser }>("/api/auth/login", {
        email: values.email,
        password: values.password,
      });
      setUser(user);
      const firstName = user.name?.split(" ")[0];
      console.log(firstName ? `Welcome back, ${firstName}.` : "Welcome back.");
      if (["ADMIN", "SUPER_ADMIN", "MENTAL_HEALTH_PROFESSIONAL", "SUPERVISOR"].includes(user.role)) {
        navigate("admin-personnel");
      } else if (!user.onboardingComplete) {
        navigate("assessment");
      } else {
        navigate("dashboard");
      }
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (err.status === 423 || err.code === "LOCKED") {
          setLockedMsg(
            err.message ||
              "Account temporarily locked after repeated failed attempts. Please try again later."
          );
        } else if (err.status === 401 || err.code === "INVALID_CREDENTIALS") {
          form.setError("password", { message: "Invalid email or password." });
        } else {
          toast.error(err.message || "Unable to sign in. Please try again.");
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
      eyebrow="Secure access"
      title="Sign in to CRPF MHS"
      description="Your confidential wellbeing companion for armed forces personnel."
      footer={
        <p>
          New to CRPF MHS?{" "}
          <button
            type="button"
            onClick={() => navigate("register")}
            className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
          >
            Create an account
          </button>
        </p>
      }
    >
      {lockedMsg && (
        <Alert variant="destructive" className="mb-4">
          <LockKeyhole className="size-4" />
          <AlertTitle>Account Locked</AlertTitle>
          <AlertDescription>{lockedMsg}</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder="soldier@crpf.gov.in"
                    aria-invalid={!!form.formState.errors.email}
                    {...field}
                  />
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
                <div className="flex items-center justify-between">
                  <FormLabel>Password</FormLabel>
                  <button
                    type="button"
                    onClick={() => navigate("forgot-password")}
                    className="text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
                  >
                    Forgot password?
                  </button>
                </div>
                <FormControl>
                  <PasswordInput
                    autoComplete="current-password"
                    placeholder="••••••••"
                    aria-invalid={!!form.formState.errors.password}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="remember"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center gap-2 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormLabel className="text-sm font-normal text-muted-foreground cursor-pointer">
                  Keep me signed in on this device
                </FormLabel>
              </FormItem>
            )}
          />

          <Button type="submit" className="h-10 w-full" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </Form>

      <div className="my-5 flex items-center gap-3" aria-hidden>
        <Separator className="flex-1" />
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          or
        </span>
        <Separator className="flex-1" />
      </div>

      {/*
        This is a real link — clicking it navigates to GET /api/auth/google
        which redirects to Google's OAuth2 consent screen with
        prompt=select_account. Google shows all accounts logged in
        on the user's device/browser and lets them pick one.
      */}
      <Button asChild variant="outline" className="h-10 w-full">
        <a href="/api/auth/google">
          <GoogleIcon className="size-4" />
          Continue with Google
        </a>
      </Button>
    </AuthShell>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
    >
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.42-1.7 4.16-5.5 4.16-3.3 0-6-2.74-6-6.11s2.7-6.11 6-6.11c1.88 0 3.14.8 3.86 1.49l2.63-2.53C16.96 3.55 14.7 2.5 12 2.5 6.86 2.5 2.7 6.66 2.7 11.8S6.86 21.1 12 21.1c5.4 0 8.97-3.8 8.97-9.15 0-.62-.07-1.09-.16-1.56H12z"
      />
    </svg>
  );
}
