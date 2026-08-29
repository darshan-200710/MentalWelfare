"use client";

import * as React from "react";
import { MailCheck, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { useApp } from "@/lib/store";

import { AuthShell } from "./AuthShell";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function VerifyEmailView() {
  const navigate = useApp((s) => s.navigate);
  const user = useApp((s) => s.user);

  const [value, setValue] = React.useState("");
  const [verifying, setVerifying] = React.useState(false);

  const complete = value.length === 6;

  async function handleVerify() {
    if (!complete) {
      toast.error("Enter the 6-digit code");
      return;
    }
    setVerifying(true);
    // Real email verification is wired in production; this preview accepts
    // any 6-digit code.
    await new Promise((r) => setTimeout(r, 700));
    setVerifying(false);
    toast.success("Email verified", {
      description: "Your account is ready.",
    });
    if (user && !user.onboardingComplete) navigate("assessment");
    else if (user) navigate("dashboard");
    else navigate("login");
  }

  function resend() {
    toast.success("New code sent", { description: "Check your inbox." });
  }

  return (
    <AuthShell
      eyebrow="One last step"
      title="Verify your email"
      description="Enter the 6-digit code we sent to your inbox to confirm your email address."
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
      <div className="flex flex-col items-center gap-5">
        <div
          className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"
          aria-hidden
        >
          <MailCheck className="size-6" />
        </div>

        <div className="flex w-full justify-center">
          <InputOTP
            maxLength={6}
            value={value}
            onChange={setValue}
            containerClassName="justify-center"
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} className="size-12 text-base" />
              <InputOTPSlot index={1} className="size-12 text-base" />
              <InputOTPSlot index={2} className="size-12 text-base" />
              <InputOTPSlot index={3} className="size-12 text-base" />
              <InputOTPSlot index={4} className="size-12 text-base" />
              <InputOTPSlot index={5} className="size-12 text-base" />
            </InputOTPGroup>
          </InputOTP>
        </div>

        <Button
          type="button"
          className="h-10 w-full"
          disabled={verifying || !complete}
          onClick={handleVerify}
        >
          {verifying ? "Verifying…" : "Verify email"}
        </Button>

        <div className="flex w-full items-center justify-between text-xs text-muted-foreground">
          <span>Didn&apos;t receive a code?</span>
          <button
            type="button"
            onClick={resend}
            className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
          >
            Resend code
          </button>
        </div>
      </div>

      <Alert className="mt-6 border-dashed bg-muted/40">
        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
        <AlertDescription className="text-xs text-muted-foreground">
          In this development preview, any 6-digit code is accepted. Production
          enforces real email verification with time-limited, single-use codes.
        </AlertDescription>
      </Alert>
    </AuthShell>
  );
}
