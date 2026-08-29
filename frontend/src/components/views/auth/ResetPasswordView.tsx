"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useApp } from "@/lib/store";
import { api } from "@/lib/api";

import { AuthShell, PasswordInput, PasswordStrength } from "./AuthShell";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const schema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters"),
    confirm: z.string().min(8, "Please confirm your password"),
  })
  .refine((d) => d.password === d.confirm, {
    path: ["confirm"],
    message: "Passwords do not match",
  });

type FormValues = z.infer<typeof schema>;

export default function ResetPasswordView() {
  const navigate = useApp((s) => s.navigate);
  const token = useApp((s) => s.params.token) || "";
  const [submitting, setSubmitting] = React.useState(false);
  const [pw, setPw] = React.useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirm: "" },
  });

  async function onSubmit(_values: FormValues) {
    setSubmitting(true);
    try {
      await api.post("/api/auth/reset-password", { token, newPassword: _values.password });
      toast.success("Password updated", {
        description: "You can now sign in with your new password.",
      });
      navigate("login");
    } catch (error: any) {
      toast.error(error.message || "Failed to reset password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Set a new password"
      title="Reset your password"
      description="Choose a strong password you haven't used before."
      footer={
        <button
          type="button"
          onClick={() => navigate("login")}
          className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
        >
          Back to sign in
        </button>
      }
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New password</FormLabel>
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

          <FormField
            control={form.control}
            name="confirm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm new password</FormLabel>
                <FormControl>
                  <PasswordInput
                    autoComplete="new-password"
                    placeholder="Re-enter your new password"
                    aria-invalid={!!form.formState.errors.confirm}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="h-10 w-full" disabled={submitting}>
            {submitting ? "Updating…" : "Update password"}
          </Button>
        </form>
      </Form>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Token validation is mocked in this preview. Production enforces signed,
        single-use reset tokens.
      </p>
    </AuthShell>
  );
}
