"use client";

import { lazy, Suspense, useEffect } from "react";
import { useApp, viewFromPath } from "@/lib/store";
import { AuthBootstrap } from "@/components/shared/auth-bootstrap";
import { PublicNavbar } from "@/components/layout/public-navbar";
import { PublicFooter } from "@/components/layout/public-footer";
import { AppShell } from "@/components/layout/app-shell";
import { AdminShell } from "@/components/layout/admin-shell";
import { LoadingScreen } from "@/components/shared/loading-screen";
import { HindiTranslationLayer } from "@/components/shared/hindi-translation-layer";
import { hasPermission } from "@/lib/constants";
import type { View } from "@/lib/store";

// ---------------------------------------------------------------------------
// Lazy-loaded views. Each lives in its own file so Turbopack can code-split.
// ---------------------------------------------------------------------------
const LandingView = lazy(() => import("@/components/views/public/LandingView"));
const AboutView = lazy(() => import("@/components/views/public/AboutView"));
const HowItWorksView = lazy(() => import("@/components/views/public/HowItWorksView"));
const ResourcesView = lazy(() => import("@/components/views/public/ResourcesView"));
const SupportView = lazy(() => import("@/components/views/public/SupportView"));
const ContactView = lazy(() => import("@/components/views/public/ContactView"));
const PrivacyView = lazy(() => import("@/components/views/public/PrivacyView"));
const LoginView = lazy(() => import("@/components/views/auth/LoginView"));
const RegisterView = lazy(() => import("@/components/views/auth/RegisterView"));
const ForgotPasswordView = lazy(() => import("@/components/views/auth/ForgotPasswordView"));
const ResetPasswordView = lazy(() => import("@/components/views/auth/ResetPasswordView"));
const VerifyEmailView = lazy(() => import("@/components/views/auth/VerifyEmailView"));
const AssessmentView = lazy(() => import("@/components/views/app/AssessmentView"));
const DashboardView = lazy(() => import("@/components/views/app/DashboardView"));
const DailyLogView = lazy(() => import("@/components/views/app/DailyLogView"));
const VoiceJournalView = lazy(() => import("@/components/views/app/VoiceJournalView"));
const AICompanionView = lazy(() => import("@/components/views/app/AICompanionView"));
const HistoryView = lazy(() => import("@/components/views/app/HistoryView"));
const ProfileView = lazy(() => import("@/components/views/app/ProfileView"));
const HelpView = lazy(() => import("@/components/views/app/HelpView"));
const SettingsView = lazy(() => import("@/components/views/app/SettingsView"));
const AdminDashboardView = lazy(() => import("@/components/views/admin/AdminDashboardView"));
const AdminPersonnelView = lazy(() => import("@/components/views/admin/AdminPersonnelView"));
const AdminPersonView = lazy(() => import("@/components/views/admin/AdminPersonView"));
const AdminRiskView = lazy(() => import("@/components/views/admin/AdminRiskView"));
const AdminAlertsView = lazy(() => import("@/components/views/admin/AdminAlertsView"));
const AdminAnalyticsView = lazy(() => import("@/components/views/admin/AdminAnalyticsView"));
const AdminAuditView = lazy(() => import("@/components/views/admin/AdminAuditView"));
const AdminSettingsView = lazy(() => import("@/components/views/admin/AdminSettingsView"));
const AdminUserManagementView = lazy(() => import("@/components/views/admin/AdminUserManagementView"));
const AdminResourcesView = lazy(() => import("@/components/views/admin/AdminResourcesView"));

const PUBLIC_VIEWS: View[] = [
  "home", "about", "how-it-works", "resources", "support", "contact",
  "login", "register", "forgot-password", "reset-password", "verify-email",
  "privacy",
];
const APP_VIEWS: View[] = [
  "dashboard", "daily-log", "voice-journal", "ai-companion", "assessment",
  "history", "profile", "settings", "help", "resources", "support",
];
const ADMIN_VIEWS: View[] = [
  "admin", "admin-personnel", "admin-person", "admin-risk",
  "admin-alerts", "admin-analytics", "admin-audit", "admin-settings",
  "admin-users", "admin-resources",
];
const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN", "MENTAL_HEALTH_PROFESSIONAL", "SUPERVISOR"];


function ViewLoader() {
  const view = useApp((s) => s.view);
  const map: Record<View, React.LazyExoticComponent<React.ComponentType>> = {
    home: LandingView, about: AboutView, "how-it-works": HowItWorksView,
    resources: ResourcesView, support: SupportView, contact: ContactView,
    privacy: PrivacyView,
    login: LoginView, register: RegisterView,
    "forgot-password": ForgotPasswordView, "reset-password": ResetPasswordView,
    "verify-email": VerifyEmailView,
    assessment: AssessmentView, dashboard: DashboardView, "daily-log": DailyLogView,
    "voice-journal": VoiceJournalView, "ai-companion": AICompanionView,
    history: HistoryView, profile: ProfileView, settings: SettingsView, help: HelpView,
    admin: AdminDashboardView, "admin-personnel": AdminPersonnelView,
    "admin-person": AdminPersonView, "admin-risk": AdminRiskView,
    "admin-alerts": AdminAlertsView, "admin-analytics": AdminAnalyticsView,
    "admin-audit": AdminAuditView, "admin-settings": AdminSettingsView,
    "admin-users": AdminUserManagementView, "admin-resources": AdminResourcesView,
  };
  const C = map[view] ?? LandingView;
  return <C />;
}

export default function Home() {
  const { view, user, navigate } = useApp();

  // Keep the dispatcher aligned with browser navigation and direct, shareable URLs.
  useEffect(() => {
    const syncFromLocation = () => {
      const next = viewFromPath(window.location.pathname);
      navigate(next.view, next.params, false);
    };
    syncFromLocation();
    window.addEventListener("popstate", syncFromLocation);
    return () => window.removeEventListener("popstate", syncFromLocation);
  }, [navigate]);

  // Guards: route based on auth + role. (UI convenience only — backend re-enforces.)
  useEffect(() => {
    if (!user) return;
    const USER_ONLY_VIEWS: View[] = ["daily-log", "voice-journal", "ai-companion", "history", "assessment"];
    if (ADMIN_ROLES.includes(user.role) && USER_ONLY_VIEWS.includes(view)) {
      navigate("admin-personnel");
      return;
    }
    if (!ADMIN_ROLES.includes(user.role) && ADMIN_VIEWS.includes(view)) {
      navigate("dashboard");
      return;
    }
    // logged-in user lingering on public/auth pages → send to dashboard
    if (PUBLIC_VIEWS.includes(view) && !["home", "privacy", "resources", "support", "contact"].includes(view)) {
      if (user.onboardingComplete) navigate("dashboard");
      else navigate("assessment");
      return;
    }
    // app view but onboarding not done → assessment
    if (APP_VIEWS.includes(view) && !["assessment", "resources", "support", "help"].includes(view) && !user.onboardingComplete) {
      navigate("assessment");
      return;
    }
    // admin view without authorized role → dashboard
    if (ADMIN_VIEWS.includes(view) && !ADMIN_ROLES.includes(user.role)) {
      navigate("dashboard");
      return;
    }
  }, [user, view, navigate]);

  // Auth-required view but no user → login
  useEffect(() => {
    if (!user && (APP_VIEWS.includes(view) || ADMIN_VIEWS.includes(view))) {
      navigate("login");
    }
  }, [user, view, navigate]);

  const isAdmin = ADMIN_VIEWS.includes(view) || (ADMIN_ROLES.includes(user?.role ?? "") && !!user && !["home", "privacy", "about", "how-it-works", "contact"].includes(view));
  const isApp = !isAdmin && ((APP_VIEWS.includes(view) && !!user) || (["support", "resources"].includes(view) && !!user));
  const isPublic = !isAdmin && !isApp;


  return (
    <AuthBootstrap>
      <div className="flex min-h-screen flex-col">
        <HindiTranslationLayer />
        {isPublic && <PublicNavbar />}
        {isAdmin ? (
          <AdminShell>
            <Suspense fallback={<LoadingScreen label="Loading CRPF MHS…" />}>
              <ViewLoader />
            </Suspense>
          </AdminShell>
        ) : isApp ? (
          <AppShell>
            <Suspense fallback={<LoadingScreen label="Loading CRPF MHS…" />}>
              <ViewLoader />
            </Suspense>
          </AppShell>
        ) : (
          <div className="flex flex-1 flex-col">
            <Suspense fallback={<LoadingScreen label="Loading CRPF MHS…" />}>
              <ViewLoader />
            </Suspense>
            <PublicFooter />
          </div>
        )}
      </div>
    </AuthBootstrap>
  );
}
