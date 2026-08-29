"use client";

import { useEffect, useState } from "react";
import {
  LayoutDashboard, BookHeart, Mic, MessageCircleHeart, History,
  BookOpen, LifeBuoy, UserRound, LogOut, Menu, ShieldCheck,
  ChevronRight, AlertTriangle,
  Languages,
} from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useApp } from "@/lib/store";
import { APP_NAV } from "@/lib/constants";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/constants";
import type { View } from "@/lib/store";
import { LevelDot } from "@/components/shared/level-pill";
import { FloatingAIChat } from "@/components/shared/floating-ai-chat";
import { BackButton } from "@/components/shared/back-button";
import { translate } from "@/lib/i18n";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, BookHeart, Mic, MessageCircleHeart, History,
  BookOpen, LifeBuoy, UserRound,
};

function useNavItems() {
  const user = useApp((s) => s.user);
  const items = [...APP_NAV];
  // admin/professional gets an Admin link
  if (user && (user.role === "ADMIN" || user.role === "SUPER_ADMIN" || user.role === "MENTAL_HEALTH_PROFESSIONAL" || user.role === "SUPERVISOR")) {
    items.push({ key: "admin", label: "Admin Console", icon: "ShieldCheck" } as any);
  }
  return items;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, view, navigate, mobileNavOpen, setMobileNavOpen, language, setLanguage } = useApp();
  const navItems = useNavItems();
  const [emergencyOpen, setEmergencyOpen] = useState(false);

  const SidebarContent = (
    <div className="flex h-full flex-col overflow-y-auto calm-scroll bg-sidebar">
      <div className="flex h-16 shrink-0 items-center border-b border-border px-5">
        <button onClick={() => navigate("dashboard")}><Logo /></button>
      </div>
      <div className="p-3 space-y-3">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = ICONS[item.icon ?? ""] ?? LayoutDashboard;
            const active = view === item.key;
            return (
              <button
                key={item.key}
                onClick={() => navigate(item.key as View)}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground/75 hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {translate(item.label, language)}
              </button>
            );
          })}
        </nav>

        {user && (
          <div className="pt-3 border-t border-border/80 space-y-1.5">
            <button
              onClick={() => navigate("profile")}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-muted transition-colors"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary font-semibold">
                {(user.name?.[0] ?? user.email[0]).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{user.name ?? user.email}</p>
                <p className="truncate text-xs text-muted-foreground">{translate(ROLE_LABELS[user.role], language)}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-foreground/80 hover:text-destructive hover:bg-destructive/10 border-border/60 transition-colors"
              onClick={async () => { await api.post("/api/auth/logout"); useApp.getState().setUser(null); useApp.getState().navigate("home"); }}
            >
              <LogOut className="mr-2 h-4 w-4 text-muted-foreground" /> Sign out
            </Button>
          </div>
        )}
      </div>
    </div>
  );


  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-border bg-sidebar lg:block">
        {SidebarContent}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <BackButton />
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                {SidebarContent}
              </SheetContent>
            </Sheet>
            <div className="lg:hidden"><Logo /></div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setLanguage(language === "en" ? "hi" : "en")} aria-label={translate(language === "en" ? "Switch to Hindi" : "Switch to English", language)}>
              <Languages className="mr-1.5 h-4 w-4" /> {language === "en" ? "हिंदी" : "English"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("support")} className="text-destructive">
              <AlertTriangle className="mr-1.5 h-4 w-4" /> {translate("Need help?", language)}
            </Button>
          </div>
        </header>

        <main className="min-h-0 flex-1">{children}</main>
        {user?.role === "USER" && <FloatingAIChat />}
      </div>
    </div>
  );
}
