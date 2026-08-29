"use client";

import {
  LayoutDashboard, Users, ShieldAlert, BellRing, BarChart3,
  ScrollText, Settings, LogOut, ChevronRight,
  Languages,
} from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useApp } from "@/lib/store";
import { ADMIN_NAV, ROLE_LABELS } from "@/lib/constants";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { View } from "@/lib/store";
import { translate } from "@/lib/i18n";
import { BackButton } from "@/components/shared/back-button";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, Users, ShieldAlert, BellRing, BarChart3, ScrollText, Settings,
};

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, view, navigate, mobileNavOpen, setMobileNavOpen, language, setLanguage } = useApp();

  const Sidebar = (
    <div className="flex h-full flex-col overflow-y-auto calm-scroll bg-sidebar">
      <div className="flex h-16 shrink-0 items-center border-b border-sidebar-border px-5">
        <button onClick={() => navigate("admin")}>
            <span className="inline-flex items-center gap-2.5">
            <Logo size={28} />
            <span className="font-semibold tracking-tight text-sidebar-foreground">CRPF MHS <span className="text-primary">Admin</span></span>
          </span>
        </button>
      </div>
      <div className="p-3 space-y-3">
        <nav className="space-y-1">
          {ADMIN_NAV.map((item) => {
            const Icon = ICONS[item.icon ?? ""] ?? LayoutDashboard;
            const activeView = view === item.key || (view === "admin-person" && item.key === "admin-personnel");
            return (
              <button
                key={item.key}
                onClick={() => navigate(item.key as View)}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  activeView ? "bg-primary text-primary-foreground shadow-sm" : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {translate(item.label, language)}
              </button>
            );
          })}
        </nav>
        <div className="pt-3 border-t border-sidebar-border/80 space-y-1.5">
          <button onClick={() => navigate("dashboard")} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-sidebar-accent transition-colors">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary font-semibold">
              {(user?.name?.[0] ?? "A").toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-sidebar-foreground">{user?.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user ? ROLE_LABELS[user.role] : ""}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start text-sidebar-foreground/80 hover:text-destructive hover:bg-destructive/10 border-sidebar-border/60 transition-colors"
            onClick={async () => { await api.post("/api/auth/logout"); useApp.getState().setUser(null); useApp.getState().navigate("home"); }}
          >
            <LogOut className="mr-2 h-4 w-4 text-muted-foreground" /> {translate("Sign out", language)}
          </Button>
        </div>
      </div>
    </div>
  );


  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 border-r border-border lg:block">
        {Sidebar}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/15 bg-[#1d256f] px-4 text-white shadow-sm backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <BackButton />
          </div>
          <div className="flex items-center gap-1">
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label={translate("Open menu", language)}
                  aria-haspopup="dialog"
                  className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/20 bg-transparent transition hover:border-white/40 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 lg:hidden"
                >
                  <span className="flex flex-col gap-[5px]" aria-hidden="true">
                    <span className="block h-[3px] w-[22px] rounded-full bg-[#FF9933]" />
                    <span className="block h-[3px] w-[22px] rounded-full bg-white/80" />
                    <span className="block h-[3px] w-[22px] rounded-full bg-[#138808]" />
                  </span>
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">{Sidebar}</SheetContent>
            </Sheet>
            <Button variant="ghost" size="sm" onClick={() => setLanguage(language === "en" ? "hi" : "en")} aria-label={translate("Toggle script", language)} className="text-white hover:bg-white/10 hover:text-white">
              <Languages className="mr-1.5 h-4 w-4" /> {language === "en" ? "हिंदी" : "English"}
            </Button>
          </div>
        </header>
        <main className="min-h-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
