"use client";

import { Logo } from "@/components/shared/logo";

export function LoadingScreen({ label = "Loading CRPF MHS…" }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#1d256f] text-white" role="status" aria-live="polite">
      <div className="loading-logo-pulse rounded-lg">
        <Logo size={72} />
      </div>
      <p className="text-sm text-white/80">{label}</p>
    </div>
  );
}
