"use client";

import { useEffect } from "react";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api";
import { LoadingScreen } from "@/components/shared/loading-screen";

// Loads the current user on mount and routes appropriately:
//  - if firstLogin && !onboardingComplete and the user tries to go to the app,
//    send them to the assessment.
export function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const { user, loadingUser, setUser, setLoadingUser, view, navigate } = useApp();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { user } = await api.get<{ user: import("@/lib/types").SafeUser | null }>("/api/auth/me");
        if (cancelled) return;
        setUser(user);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoadingUser(false);
      }
    })();
    return () => { cancelled = true; };
  }, [setUser, setLoadingUser]);

  // First-login onboarding enforcement: if logged in but onboarding not complete
  // and the user is trying to enter the app, push them to assessment.
  useEffect(() => {
    if (user && !user.onboardingComplete) {
      const appViews = ["dashboard", "daily-log", "voice-journal", "ai-companion", "history", "profile", "settings", "help"];
      if (appViews.includes(view)) {
        navigate("assessment");
      }
    }
  }, [user, view, navigate]);

  if (loadingUser) {
    return <LoadingScreen />;
  }

  return <>{children}</>;
}
