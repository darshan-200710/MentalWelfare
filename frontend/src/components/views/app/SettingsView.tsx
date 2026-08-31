"use client";

import { useEffect, useState } from "react";
import {
  BellRing, Type, Accessibility, ShieldCheck,
  Database, ChevronRight, Save, Contrast, Eye,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type FontSize = "small" | "normal" | "large" | "x-large";

const FONT_SIZES: { value: FontSize; label: string; scale: number }[] = [
  { value: "small",   label: "Small",       scale: 0.9 },
  { value: "normal",  label: "Default",     scale: 1 },
  { value: "large",   label: "Large",       scale: 1.12 },
  { value: "x-large", label: "Extra large", scale: 1.25 },
];

const FONT_STORAGE = "sentinel:font-size";
const NOTIF_STORAGE = "sentinel:notifications";
const MOTION_STORAGE = "sentinel:reduce-motion";
const CONTRAST_STORAGE = "sentinel:high-contrast";

interface NotifPrefs {
  dailyReminder: boolean;
  supportUpdates: boolean;
  aiCompanion: boolean;
  wellbeingTips: boolean;
  productNews: boolean;
}
const DEFAULT_NOTIFS: NotifPrefs = {
  dailyReminder: true,
  supportUpdates: true,
  aiCompanion: false,
  wellbeingTips: true,
  productNews: false,
};

function readFontSize(): FontSize {
  try {
    const fs = localStorage.getItem(FONT_STORAGE) as FontSize | null;
    if (fs && FONT_SIZES.some((f) => f.value === fs)) return fs;
  } catch { /* ignore */ }
  return "normal";
}
function readNotifs(): NotifPrefs {
  try {
    const n = localStorage.getItem(NOTIF_STORAGE);
    if (n) return { ...DEFAULT_NOTIFS, ...JSON.parse(n) };
  } catch { /* ignore */ }
  return DEFAULT_NOTIFS;
}
function readBoolPref(key: string, fallback: () => boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v !== null) return v === "1";
    return fallback();
  } catch { return fallback(); }
}

export default function SettingsView() {
  const { navigate } = useApp();

  const [fontSize, setFontSize] = useState<FontSize>(readFontSize);
  const [reduceMotion, setReduceMotion] = useState(() =>
    readBoolPref(MOTION_STORAGE, () =>
      typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    )
  );
  const [highContrast, setHighContrast] = useState(() => readBoolPref(CONTRAST_STORAGE, () => false));
  const [notifications, setNotifications] = useState<NotifPrefs>(readNotifs);

  // apply font size to document root
  useEffect(() => {
    const scale = FONT_SIZES.find((f) => f.value === fontSize)?.scale ?? 1;
    document.documentElement.style.setProperty("--font-scale", String(scale));
    document.documentElement.style.fontSize = `${16 * scale}px`;
    try { localStorage.setItem(FONT_STORAGE, fontSize); } catch { /* ignore */ }
  }, [fontSize]);

  // apply motion + contrast prefs (sync external systems)
  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", reduceMotion);
    try { localStorage.setItem(MOTION_STORAGE, reduceMotion ? "1" : "0"); } catch { /* ignore */ }
  }, [reduceMotion]);

  useEffect(() => {
    document.documentElement.classList.toggle("high-contrast", highContrast);
    try { localStorage.setItem(CONTRAST_STORAGE, highContrast ? "1" : "0"); } catch { /* ignore */ }
  }, [highContrast]);

  useEffect(() => {
    try { localStorage.setItem(NOTIF_STORAGE, JSON.stringify(notifications)); } catch { /* ignore */ }
  }, [notifications]);

  function saveNotifications() {
    try { localStorage.setItem(NOTIF_STORAGE, JSON.stringify(notifications)); } catch { /* ignore */ }
    console.log("Notification preferences saved.");
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6">
        <h1 className="serif text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Settings</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Personalize how CRPF MHS looks and behaves.</p>
      </div>

      {/* Accessibility */}
      <Card className="border-border/60">
        <CardContent className="space-y-5">
          {/* Font size */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label className="flex items-center gap-2 text-xs font-medium text-foreground">
                <Type className="h-3.5 w-3.5" /> Font size
              </Label>
              <span className="text-xs text-muted-foreground">
                {FONT_SIZES.find((f) => f.value === fontSize)?.label}
              </span>
            </div>
            <Slider
              value={[FONT_SIZES.findIndex((f) => f.value === fontSize)]}
              min={0}
              max={FONT_SIZES.length - 1}
              step={1}
              onValueChange={(v) => setFontSize(FONT_SIZES[v[0]]?.value ?? "normal")}
              aria-label="Font size"
            />
            <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
              {FONT_SIZES.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFontSize(f.value)}
                  className="rounded px-1 py-0.5 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {f.label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Preview:</p>
            <p className="mt-1 text-sm text-foreground">
              The quick brown fox jumps over the lazy dog.
            </p>
          </div>

          <Separator />

          {/* Accessibility */}
          <div className="space-y-1">
            <Label className="flex items-center gap-2 text-xs font-medium text-foreground">
              <Accessibility className="h-3.5 w-3.5" /> Accessibility
            </Label>
            <ToggleRow
              icon={Eye}
              label="Reduce motion"
              desc="Minimize animations and transitions."
              checked={reduceMotion}
              onChange={setReduceMotion}
            />
            <ToggleRow
              icon={Contrast}
              label="High contrast"
              desc="Boost contrast for better readability."
              checked={highContrast}
              onChange={setHighContrast}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="mt-6 border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
            <BellRing className="h-4 w-4 text-primary" /> Notifications
          </CardTitle>
          <CardDescription className="text-xs">Choose which updates you'd like to receive.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          <ToggleRow label="Daily check-in reminder" desc="A gentle nudge to log your mood each day."
            checked={notifications.dailyReminder}
            onChange={(v) => setNotifications((p) => ({ ...p, dailyReminder: v }))} />
          <ToggleRow label="Support updates" desc="When your support request status changes."
            checked={notifications.supportUpdates}
            onChange={(v) => setNotifications((p) => ({ ...p, supportUpdates: v }))} />
          <ToggleRow label="AI Companion news" desc="When new companion features are added."
            checked={notifications.aiCompanion}
            onChange={(v) => setNotifications((p) => ({ ...p, aiCompanion: v }))} />
          <ToggleRow label="Wellbeing tips" desc="Occasional articles & resources."
            checked={notifications.wellbeingTips}
            onChange={(v) => setNotifications((p) => ({ ...p, wellbeingTips: v }))} />
            <ToggleRow label="Product news" desc="CRPF MHS platform updates."
            checked={notifications.productNews}
            onChange={(v) => setNotifications((p) => ({ ...p, productNews: v }))} />

          <div className="flex justify-end pt-3">
            <Button size="sm" onClick={saveNotifications}>
              <Save className="mr-1.5 h-3.5 w-3.5" /> Save preferences
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Security & Sessions */}
      <Card className="mt-6 border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" /> Security & Active Sessions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium">Two-Factor Authentication (MFA)</p>
              <p className="text-xs text-muted-foreground">Add an extra layer of security to your account.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => console.log("MFA setup initiated")}>Enable MFA</Button>
          </div>
          <Separator />
          <div>
            <p className="text-sm font-medium mb-2">Active Sessions</p>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm border rounded p-2">
                <div>
                  <p className="font-medium">Windows • Chrome</p>
                  <p className="text-xs text-muted-foreground">IP: 192.168.1.5 (Current Session)</p>
                </div>
                <Badge variant="secondary">Active</Badge>
              </div>
              <div className="flex justify-between items-center text-sm border rounded p-2">
                <div>
                  <p className="font-medium">iOS • Safari</p>
                  <p className="text-xs text-muted-foreground">IP: 10.0.0.2</p>
                </div>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => console.log("Session revoked")}>Revoke</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Privacy & data */}
      <Card className="mt-6 border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" /> Privacy & data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <LinkRow icon={ShieldCheck} label="Privacy policy" desc="How we collect, use & protect your data."
            onClick={() => navigate("privacy")} />
          <LinkRow icon={Database} label="Manage consent" desc="Grant or withdraw processing consent per purpose."
            onClick={() => navigate("profile")} />
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        CRPF MHS Wellbeing Platform · v1.0.0
      </p>
    </div>
  );
}

function ToggleRow({
  icon: Icon, label, desc, checked, onChange,
}: {
  icon?: any; label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex items-start gap-2.5">
        {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
        <div className="pr-3">
          <p className="text-sm font-medium text-foreground">{label}</p>
          {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}

function LinkRow({ icon: Icon, label, desc, onClick }: { icon: any; label: string; desc: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg py-2.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}
