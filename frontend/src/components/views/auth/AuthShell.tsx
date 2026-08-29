"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Logo } from "@/components/shared/logo";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/store";

/**
 * Shared layout for all authentication views.
 * Renders an open split layout with a photographic identity rail and focused form area.
 */
export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const language = useApp((state) => state.language);
  return (
    <div className="relative flex min-h-[78vh] flex-1 items-center justify-center overflow-hidden bg-[linear-gradient(180deg,#f7f9fc_0%,#f2f1ed_38%,#e8e3d8_100%)] px-4 py-8 sm:px-6 lg:py-12">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,rgba(29,37,111,0.14)_1px,transparent_1.5px)] bg-[size:22px_22px] opacity-35" />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="relative grid w-full max-w-6xl lg:grid-cols-[0.9fr_1.1fr]"
      >
        <div className="relative hidden min-h-[620px] overflow-hidden bg-[#1d256f] p-8 text-white lg:flex lg:flex-col lg:justify-between xl:p-12">
          <div className="absolute inset-0 bg-[url('/crpf2.png')] bg-cover bg-center opacity-25 grayscale" />
          <div className="absolute inset-0 bg-[#1d256f]/90 mix-blend-multiply" />
          <div className="hero-grid absolute inset-0 opacity-25" />
          <div className="relative z-10">
            <Logo size={48} />
            <p className="mt-12 font-mono text-[10px] uppercase tracking-[0.24em] text-white/65">CRPF MHS / A PRIVATE SPACE</p>
            <h2 className="serif mt-4 max-w-sm text-4xl font-medium leading-[1.05] xl:text-5xl">
              Make room for how you feel.
            </h2>
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-white/75">
              A calm place to pause, reflect, and find your next step.
            </p>
          </div>
        </div>

        <div className="bg-[#f6f2e9] px-6 py-8 sm:px-12 sm:py-12">
          <div className="mx-auto max-w-md">
            <div className="mx-auto flex justify-center lg:hidden">
              <Logo size={34} />
            </div>
            <div className="space-y-1.5">
              {eyebrow && (
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  {eyebrow}
                </p>
              )}
              <h1 className="text-xl font-semibold text-[#172638]">{title}</h1>
              {description && (
                <p className="text-sm leading-relaxed text-[#536b83]">
                  {description}
                </p>
              )}
            </div>
          </div>
          <div className="mx-auto mt-8 max-w-md">
            {children}
            {footer && (
              <div className="mt-6 text-center text-sm text-[#536b83]">
                {footer}
              </div>
            )}
          </div>
        </div>

        <p className="absolute -bottom-8 left-0 right-0 text-center text-xs text-[#536b83]">
          {language === "hi" ? "स्थानांतरण के दौरान एन्क्रिप्टेड · केवल अधिकृत कर्मियों के लिए उपलब्ध" : "Encrypted in transit · Accessible only to authorised personnel"}
        </p>
      </motion.div>
    </div>
  );
}

/**
 * Password strength meter — on-brand teal with red only for "weak".
 * Shared by Register and Reset-password views.
 */
export function PasswordStrength({ password }: { password: string }) {
  const { score, label } = scorePassword(password);
  const colors = [
    "bg-muted",
    "bg-destructive/70",
    "bg-primary/40",
    "bg-primary/70",
    "bg-primary",
  ];
  return (
    <div className="flex items-center gap-2" aria-hidden>
      <div className="flex flex-1 gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={
              "h-1.5 flex-1 rounded-full transition-colors " +
              (i < score ? colors[score] : "bg-muted")
            }
          />
        ))}
      </div>
      <span className="w-12 text-right text-xs text-muted-foreground">
        {password ? label : "—"}
      </span>
    </div>
  );
}

export function scorePassword(pw: string): {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
} {
  if (!pw) return { score: 0, label: "—" };
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const score = Math.min(s, 4) as 0 | 1 | 2 | 3 | 4;
  const labels = ["Too short", "Weak", "Fair", "Good", "Strong"];
  return { score, label: labels[score] };
}

/**
 * Password input with a leading lock icon and a trailing show/hide toggle.
 * Forwards all input props, so it can be dropped straight into a FormField.
 */
export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { value?: string }
>(function PasswordInput({ className, ...props }, ref) {
  const [show, setShow] = React.useState(false);
  return (
    <div className="relative">
      <LockKeyhole
        className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        ref={ref}
        type={show ? "text" : "password"}
        className={cn("pl-9 pr-10", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-1.5 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
});
