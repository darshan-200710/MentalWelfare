# Agent Work Record — Task ID 7 (Admin Console Pages)

**Agent:** full-stack-developer (admin pages)
**Task:** Build 8 admin console view components for the Sentinel Wellbeing Platform.

## Scope
Created files ONLY in `/home/z/my-project/src/components/views/admin/`:

| File | View key | Purpose |
|------|----------|---------|
| `_shared.tsx` (helper) | — | Shared admin UI: `AdminPage`, `RestrictedNotice`, `PermissionNotice`, `AuditedBadge`, `StatusBadge`, `SupportStatusBadge`, `RiskFootnote`, `ErrorPanel`, `SkeletonCard`, time formatters (`relTime`, `fmtDate`, `fmtDateTime`). |
| `AdminDashboardView.tsx` | `admin` | Stat cards + risk distribution BarChart + recent alerts table + personnel-requiring-attention list. VIEW_ANALYTICS-gated. |
| `AdminPersonnelView.tsx` | `admin-personnel` | Searchable/filterable personnel directory with table (desktop) / cards (mobile) + pagination. |
| `AdminPersonView.tsx` | `admin-person` (`params.id`) | Person detail: header, profile, latest risk + sparkline, alerts, support requests, gated assessment/journal/voice/conversation sections with `RestrictedNotice` fallbacks. |
| `AdminRiskView.tsx` | `admin-risk` | Risk distribution horizontal bar + alert trend LineChart + recent alerts table + summary tiles. Filtered by unit/level/days. |
| `AdminAlertsView.tsx` | `admin-alerts` | Alert triage table: filter by status/severity, dropdown row-actions (assign-to-me, set status), PUT updates with toast. Table on desktop, cards on mobile. |
| `AdminAnalyticsView.tsx` | `admin-analytics` | Risk distribution donut, per-unit stacked bar, 14-day activity 4-series line chart. VIEW_ANALYTICS-gated. |
| `AdminAuditView.tsx` | `admin-audit` | Read-only audit log table with action filter, collapsible JSON metadata rows. VIEW_AUDIT_LOGS-gated. |
| `AdminSettingsView.tsx` | `admin-settings` | Platform info, environment, consent version, RBAC permission matrix, dev seed-regenerate button (AlertDialog). |

## Key Design Decisions
1. **Shared `_shared.tsx`** kept inside the admin folder (per task scope rule "Do NOT modify files outside `src/components/views/admin/`"). Exports reusable helpers used by every view.
2. **Permission gating is double-layered**: client-side via `hasPermission(role, perm)` for cosmetic UX, AND respects the `visible` flags + 403 responses returned by the backend. `PermissionNotice` and `RestrictedNotice` are used wherever a section is gated.
3. **Sensitive content is clearly marked** with an `AuditedBadge` ("Sensitive — access audited") on the assessment history, journal entries, voice transcripts, and AI conversations sections in `AdminPersonView`. The backend re-enforces audit logging on every read.
4. **Risk indicators NEVER appear color-only**: every severity/level uses `LevelPill` or `LevelDot` (icon + label + color) from `@/components/shared/level-pill`. Chart colors come from `LEVEL_META[level].dot`.
5. **Footnote on every risk view**: "These are internal operational wellbeing indicators, not clinical diagnoses." via `RiskFootnote`.
6. **Responsive**: tables on `md:`/`lg:` breakpoints collapse to cards on mobile for Personnel, Alerts. Risk/Analytics/Audit keep horizontal scroll for tables but use fluid chart containers.
7. **Charts**: recharts (BarChart, LineChart, PieChart). Colors pulled from `LEVEL_META` hex dots or named teal/amber/orange/red Tailwind palette — NO indigo/blue.
8. **Loading**: every view has skeleton states. Errors use `ErrorPanel` with retry. Empty states use `EmptyState` from `@/components/shared/ui`.
9. **Toast feedback**: `sonner` toast for alert status updates and seed regeneration in Settings.
10. **Seed regeneration**: `AlertDialog` confirmation before POST `/api/seed?force=1`. Disabled-looking badge when not in dev.

## Lint status
- All 8 admin views + `_shared.tsx` lint cleanly.
- 2 pre-existing lint errors remain in `src/lib/audit.ts` (line 11) and `src/lib/auth.ts` (line 89) — `@typescript-eslint/no-require-imports`. These are out of scope (outside `src/components/views/admin/`) and were not modified.

## Notes for downstream agents
- The admin shell (`AdminShell`) wraps these views. The shell's `<main>` has no padding, so every view starts with `<AdminPage>` which provides `p-4 sm:p-6 lg:p-8`.
- The Zustand router: `useApp()` exposes `view`, `params`, `navigate(view, params?)`, `user`. For `admin-person`, the person ID is in `params.id`.
- The dashboard's "View all" link pre-filters personnel via `navigate("admin-personnel", { level: "HIGH" })` — the personnel view reads `params.level`/`params.unit`/`params.q` as initial state.
- Chart cell color keys reference `LEVEL_META[level].dot` directly (do not use Tailwind class names in recharts `fill`).
