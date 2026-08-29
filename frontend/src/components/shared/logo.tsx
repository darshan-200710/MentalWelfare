"use client";

import Image from "next/image";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";

const LOGO_SRC = "/logo.png";


export function Logo({ className, size = 52 }: { className?: string; size?: number }) {
  return (
    <Image
      src={LOGO_SRC}
      alt="CRPF Mental Health Support"
      width={size}
      height={size}
      priority
      sizes="(max-width: 768px) 52px, 72px"
      className={cn("rounded-md bg-white p-1 object-contain shadow-[0_2px_10px_rgba(0,0,0,0.3)]", className)}
      style={{ width: size, height: size }}
    />
  );
}

export function LogoButton() {
  const navigate = useApp((s) => s.navigate);
  const user = useApp((s) => s.user);
  return (
    <button
      onClick={() => navigate(user ? "dashboard" : "home")}
      className="flex h-16 items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label="CRPF Mental Health Support home"
    >
      <Logo size={44} />
    </button>
  );
}
