"use client";

import { ArrowLeft } from "lucide-react";
import { useApp } from "@/lib/store";
import { translate } from "@/lib/i18n";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN", "MENTAL_HEALTH_PROFESSIONAL", "SUPERVISOR"];

export function BackButton() {
  const language = useApp((state) => state.language);
  const navigate = useApp((state) => state.navigate);
  const user = useApp((state) => state.user);

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    } else {
      if (user) {
        if (ADMIN_ROLES.includes(user.role)) {
          navigate("admin");
        } else {
          navigate("dashboard");
        }
      } else {
        navigate("home");
      }
    }
  }

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label={translate("Go back", language)}
      className="group inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-current/15 px-3 text-sm font-medium transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/10 hover:shadow-sm active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
    >
      <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" aria-hidden="true" />
      <span>{translate("Back", language)}</span>
    </button>
  );
}

