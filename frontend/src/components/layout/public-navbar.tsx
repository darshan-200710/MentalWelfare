"use client";

import { useEffect, useState } from "react";
import { Accessibility, Minus, Phone, Plus } from "lucide-react";
import { LogoButton } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useApp } from "@/lib/store";
import { PUBLIC_NAV } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { BackButton } from "@/components/shared/back-button";
import { translate } from "@/lib/i18n";

const FONT_OPTIONS = [
  { value: "small", label: "Small", scale: 0.9 },
  { value: "normal", label: "Normal", scale: 1 },
  { value: "large", label: "Large", scale: 1.12 },
  { value: "x-large", label: "Extra large", scale: 1.25 },
] as const;

type FontSize = (typeof FONT_OPTIONS)[number]["value"];

function readFontSize(): FontSize {
  if (typeof window === "undefined") return "normal";
  const saved = localStorage.getItem("sentinel:font-size") as FontSize | null;
  return FONT_OPTIONS.some((option) => option.value === saved) ? saved! : "normal";
}

function ScriptGlyph() {
  return (
    <span aria-hidden="true" className="flex items-baseline gap-[1px] text-[0.8rem] font-bold leading-none tracking-wide">
      <span className="font-serif">अ</span>
      <span className="text-[0.68rem]">A</span>
    </span>
  );
}

function UtilityButton({
  label,
  onClick,
  children,
  active = false,
}: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className="group relative flex items-center px-2.5 py-1 text-white/85 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#2E3192]"
    >
      {children}
      <span className="pointer-events-none absolute bottom-0 left-1/2 h-[2px] w-0 -translate-x-1/2 rounded-full bg-white/90 shadow-[0_0_6px_rgba(255,255,255,0.8)] transition-all duration-200 group-hover:w-4" />
    </button>
  );
}

const translations = {
  en: {
    login: "Login",
    register: "Register",
    emergency: "Need immediate help?",
    language: "हिंदी",
    menu: "Menu",
    accessibility: "Accessibility",
    fontSize: "Font size",
    highContrast: "High contrast",
    reduceMotion: "Reduce motion",
    reset: "Reset",
    accessibilityOptions: "Accessibility options",
    switchLanguage: "Switch to Hindi",
    close: "Close accessibility menu",
  },
  hi: {
    login: "लॉगिन",
    register: "रजिस्टर",
    emergency: "तुरंत मदद चाहिए?",
    language: "EN",
    menu: "मेनू",
    accessibility: "अभिगम्यता",
    fontSize: "फ़ॉन्ट आकार",
    highContrast: "उच्च कंट्रास्ट",
    reduceMotion: "आने वाले आंदोलनों को कम करें",
    reset: "रीसेट",
    accessibilityOptions: "अभिगम्यता विकल्प",
    switchLanguage: "अंग्रेज़ी पर स्विच करें",
    close: "अभिगम्यता मेनू बंद करें",
  },
} as const;

const NAV_LABELS: Record<string, { en: string; hi: string }> = {
  home: { en: "Home", hi: "होम" },
  about: { en: "About", hi: "हमारे बारे में" },
  "how-it-works": { en: "How It Works", hi: "यह कैसे काम करता है" },
  resources: { en: "Resources", hi: "साधन" },
  support: { en: "Support", hi: "सहायता" },
  contact: { en: "Contact", hi: "संपर्क" },
};

export function PublicNavbar() {
  const { view, navigate, language, setLanguage, user } = useApp();
  const [open, setOpen] = useState(false);
  const [accessibilityOpen, setAccessibilityOpen] = useState(false);
  const [scrolledPastHero, setScrolledPastHero] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>(readFontSize);
  const t = translations[language];
  const isAdmin = user && ["ADMIN", "SUPER_ADMIN", "MENTAL_HEALTH_PROFESSIONAL", "SUPERVISOR"].includes(user.role);

  useEffect(() => {
    const saved = localStorage.getItem("sentinel:language");
    if (saved === "en" || saved === "hi") setLanguage(saved);
  }, [setLanguage]);

  const toggleLanguage = () => setLanguage(language === "en" ? "hi" : "en");

  useEffect(() => {
    const updateScrollState = () => setScrolledPastHero(window.scrollY > window.innerHeight * 0.7);
    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollState);
  }, []);

  useEffect(() => {
    const scale = FONT_OPTIONS.find((option) => option.value === fontSize)?.scale ?? 1;
    document.documentElement.style.setProperty("--font-scale", String(scale));
    document.documentElement.style.fontSize = `${16 * scale}px`;
    localStorage.setItem("sentinel:font-size", fontSize);
  }, [fontSize]);

  const navItems = [...PUBLIC_NAV.map((item) => ({ ...item, label: NAV_LABELS[item.key][language] })), { key: "contact", label: NAV_LABELS.contact[language] }];

  return (
    <header className={cn("left-0 top-0 z-40 w-full", view === "home" ? "absolute" : "relative")}>
      <div className="h-[6px] w-full bg-[linear-gradient(90deg,#FF9933_0,#FF9933_33.33%,#FFFFFF_33.33%,#FFFFFF_66.66%,#138808_66.66%,#138808_100%)]" />

      <div className="border-b border-white/10 bg-[#1d256f] text-white shadow-[inset_0_-1px_0_rgba(255,255,255,0.12)]">
        <div className="mx-auto flex h-9 max-w-7xl items-center justify-end px-4 sm:px-6 lg:px-8">
          <div className="flex items-center divide-x divide-white/35">
            <UtilityButton label={t.accessibilityOptions} onClick={() => setAccessibilityOpen((curr) => !curr)} active={accessibilityOpen}>
              <Accessibility className="h-5 w-5 stroke-[1.75]" />
            </UtilityButton>

            <UtilityButton label={t.switchLanguage} onClick={toggleLanguage}>
              <ScriptGlyph />
            </UtilityButton>
          </div>

          {accessibilityOpen && (
            <div className="absolute right-4 top-[2.3rem] z-50 w-[280px] rounded-xl border border-white/20 bg-[#101b4d]/95 p-3 text-left shadow-2xl shadow-slate-950/30 backdrop-blur-sm sm:right-6 lg:right-8">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-white">{t.accessibility}</p>
                <button
                  type="button"
                  onClick={() => setAccessibilityOpen(false)}
                  aria-label={t.close}
                  className="rounded-md p-1 text-white/80 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                >
                  ×
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-300">{t.fontSize}</p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Decrease font size"
                      onClick={() => setFontSize((current) => {
                        const idx = FONT_OPTIONS.findIndex((option) => option.value === current);
                        const next = FONT_OPTIONS[Math.max(0, idx - 1)];
                        return next.value;
                      })}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/20 bg-white/5 text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <div className="flex flex-1 items-center justify-center rounded-md border border-white/20 bg-white/5 px-2 py-1.5 text-xs text-slate-100">
                      {FONT_OPTIONS.find((o) => o.value === fontSize)?.label}
                    </div>
                    <button
                      type="button"
                      aria-label={t.reset}
                      onClick={() => setFontSize("normal")}
                      className="rounded-md border border-white/20 bg-white/5 px-2 py-1.5 text-xs text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                    >
                      {t.reset}
                    </button>
                    <button
                      type="button"
                      aria-label="Increase font size"
                      onClick={() => setFontSize((current) => {
                        const idx = FONT_OPTIONS.findIndex((option) => option.value === current);
                        const next = FONT_OPTIONS[Math.min(FONT_OPTIONS.length - 1, idx + 1)];
                        return next.value;
                      })}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/20 bg-white/5 text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-b border-transparent bg-transparent">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          {view !== "home" && <BackButton />}
          {view === "home" && (
            <div className={cn(
              "flex min-w-0 items-center gap-3 overflow-hidden transition-all duration-500 ease-out",
              scrolledPastHero ? "max-w-0 -translate-x-3 opacity-0" : "max-w-[360px] translate-x-0 opacity-100"
            )}>
              <LogoButton />
              <span className="max-w-[190px] text-sm font-bold uppercase leading-tight tracking-[0.04em] text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)] sm:max-w-none sm:text-base" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
                CRPF MENTAL HEALTH SUPPORT
              </span>
            </div>
          )}

          {view === "home" && (
            <div className={cn(
              "flex items-center gap-2 rounded-xl px-1.5 py-1 transition-all duration-300 sm:gap-3 sm:px-2",
              scrolledPastHero ? "bg-[#1d256f]/85 shadow-lg backdrop-blur-md" : "bg-transparent"
            )}>
            {user ? (
              <Button className="hidden sm:inline-flex border border-white/20 bg-transparent text-white hover:border-white/40 hover:bg-white/5" onClick={() => navigate(isAdmin ? "admin-personnel" : "dashboard")}>
                {translate(isAdmin ? "Admin Console" : "Dashboard", language)}
              </Button>
            ) : (
              <>
                <Button variant="secondary" className="hidden sm:inline-flex border border-white/20 bg-transparent text-white hover:border-white/40 hover:bg-white/5" onClick={() => navigate("login")}>
                  {t.login}
                </Button>
                <Button className="hidden sm:inline-flex border border-white/20 bg-transparent text-white hover:border-white/40 hover:bg-white/5" onClick={() => navigate("register")}>
                  {t.register}
                </Button>
              </>
            )}

            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label={t.menu}
                  aria-haspopup="dialog"
                  className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/20 bg-transparent transition hover:border-white/40 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                >
                  <span className="flex flex-col gap-[5px]">
                    <span className="block h-[3px] w-[22px] rounded-full bg-[#FF9933] transition-colors" />
                    <span className="block h-[3px] w-[22px] rounded-full bg-white/80 transition-colors" />
                    <span className="block h-[3px] w-[22px] rounded-full bg-[#138808] transition-colors" />
                  </span>
                </button>
              </SheetTrigger>

              <SheetContent
                side="right"
                className="flex w-[300px] flex-col rounded-l-[24px] border-white/15 text-white sm:w-[340px] [&>button]:text-white [&>button]:hover:bg-white/10 [&>button]:focus-visible:ring-white/80"
                style={{
                  backgroundColor: "rgba(18, 35, 92, 0.78)",
                  backdropFilter: "blur(16px)",
                  WebkitBackdropFilter: "blur(16px)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  boxShadow: "-8px 0 32px rgba(0, 0, 0, 0.3)",
                }}
              >
                <SheetHeader className="text-left">
                  <SheetTitle className="flex items-center gap-3 text-white">
                    <LogoButton />
                    <span className="max-w-[180px] text-sm font-bold uppercase leading-tight tracking-[0.04em] text-white" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
                      CRPF MENTAL HEALTH SUPPORT
                    </span>
                  </SheetTitle>
                </SheetHeader>

                <nav aria-label="Primary" className="mt-6 flex flex-1 flex-col gap-1 overflow-y-auto">
                  {navItems.map((item) => (
                    <button
                      key={item.key}
                      onClick={() => {
                        navigate(item.key as any);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex items-center rounded-md px-3 py-2.5 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        view === item.key ? "bg-white/15 text-white" : "text-white/85 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <span
                        className={cn(
                          "mr-3 h-4 w-[3px] rounded-full transition-colors",
                          view === item.key ? "bg-[#FF9933]" : "bg-transparent"
                        )}
                      />
                      {item.label}
                    </button>
                  ))}

                  <div className="mt-4 flex flex-col gap-2 sm:hidden">
                    {user ? (
                      <Button variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={() => { navigate(isAdmin ? "admin-personnel" : "dashboard"); setOpen(false); }}>
                        {translate(isAdmin ? "Admin Console" : "Dashboard", language)}
                      </Button>
                    ) : (
                      <>
                        <Button variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={() => { navigate("login"); setOpen(false); }}>{t.login}</Button>
                        <Button className="border-white/30 bg-white/10 text-white hover:bg-white/20" onClick={() => { navigate("register"); setOpen(false); }}>{t.register}</Button>
                      </>
                    )}
                  </div>

                  <div className="my-3 h-px bg-white/20" />
                  <Button variant="ghost" className="w-full justify-start text-orange-200 hover:bg-orange-400/10 hover:text-orange-100" onClick={() => { navigate("support"); setOpen(false); }}>
                    <Phone className="mr-2 h-4 w-4" /> {t.emergency}
                  </Button>
                </nav>
              </SheetContent>
            </Sheet>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
