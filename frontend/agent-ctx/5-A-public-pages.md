# Task 5-A — Public marketing pages

**Agent:** full-stack-developer (public pages)
**Scope:** 7 default-exported React views in `src/components/views/public/`.

## Files created
- `src/components/views/public/LandingView.tsx` (view key: `home`)
- `src/components/views/public/AboutView.tsx` (view key: `about`)
- `src/components/views/public/HowItWorksView.tsx` (view key: `how-it-works`)
- `src/components/views/public/ResourcesView.tsx` (view key: `resources`)
- `src/components/views/public/SupportView.tsx` (view key: `support`)
- `src/components/views/public/ContactView.tsx` (view key: `contact`)
- `src/components/views/public/PrivacyView.tsx` (view key: `privacy`)

## Existing patterns observed (in /home/z/my-project)
- Zustand store: `useApp()` → `{ view, params, navigate, user, theme, toggleTheme }` (src/lib/store.ts).
- Client fetcher: `api.get/post/put/del/upload/blob` (src/lib/api.ts) — throws `ApiRequestError` on non-2xx.
- Public API routes that already exist (do NOT modify them):
  - `GET /api/resources` → `{ resources: ResourceDTO[] }`
  - `GET /api/emergency-contacts` → `{ contacts: EmergencyContactDTO[] }`
  - `POST /api/support` (auth required) → body `{ type: "general"|"counselling"|"urgent"|"peer", message: string(1..2000) }` → `{ ok, id }`
- Design tokens: deep-teal `--primary` oklch(0.42 0.05 178) + warm sand neutrals + amber accent (globals.css). NEVER indigo/blue. `.hero-grid` class exists for hero backgrounds.
- shadcn/ui set is complete (New York style). All exports use named exports.
- Toaster is mounted in `src/app/layout.tsx` via `sonner` (top-right, richColors). Import `toast` from `sonner` directly.

## Key design decisions
1. **Calm, professional, government/armed-forces tone** — no neon, no childish wellness-app aesthetics. Generous spacing (`py-12 lg:py-16`), soft borders, subtle shadows.
2. **Amber (not red) for "immediate help" panels** — distinct, warm, non-alarming. Localised `bg-amber-50/70 border-amber-200 text-amber-900` (dark equivalents included).
3. **Mobile-first responsive** — every layout uses `sm:` / `lg:` breakpoints; touch targets ≥ `h-9` buttons.
4. **Accessibility** — semantic HTML (`<section>`, `<ol>`, `<nav>`, `<aside>`), ARIA labels on icon-only buttons, `aria-pressed` on filter chips, `aria-invalid` on form fields, `aria-describedby` on textarea, focus-visible rings preserved.
5. **ResourcesView** — public (works without login). Skeleton loading, EmptyState, error+retry, keyboard-accessible cards (Enter/Space opens Dialog), Dialog shows full body + tags + source.
6. **SupportView** — fetches emergency contacts; auto-detects "emergency" contact by label/hours and gives it an `id="emergency-contact"` so the landing page's "Emergency Assistance" CTA can deep-link via `navigate("support", { focus: "emergency" })`. Inline support-request form for logged-in users POSTs to `/api/support` with type+message; uses `sonner` toast on success.
7. **ContactView** — `react-hook-form` + `zodResolver` + `zod` schema. No backend wired → simulates 600ms submission then shows success toast and resets form. Includes a side panel that routes to Support for wellbeing concerns.
8. **PrivacyView** — honest policy with prominent "Sentinel is not anonymous" amber disclaimer. Sticky TOC on `lg+`, accordion sections (8), references `CONSENT_VERSION` from constants.
9. **LandingView** — sections in order: hero (with `hero-grid` bg + trust badges), 6-card features grid, "Need immediate help?" warm card, 3-step how-it-works preview, privacy & trust section, final CTA band. Uses `framer-motion` for subtle feature-card fade-ins on scroll.
10. **HowItWorksView** — 7-step vertical stepper (numbered badges + lucide icon + body) plus an accordion FAQ (6 Q&As). Step 6 (internal monitoring) carries an explicit "Operational, not diagnostic" badge.

## Validation
- `npx eslint src/components/views/public/` → clean (no errors, no warnings).
- `npx tsc --noEmit` → no errors in any of the 7 public view files (pre-existing errors only in `AdminAnalyticsView.tsx` and `lib/{audit,auth}.ts` from other agents).
- `bun run lint` overall still fails due to unrelated files (audit.ts `require`, AdminAnalyticsView JSX) — NOT caused by my changes.

## Notes for downstream agents
- The `src/app/page.tsx` dispatcher still throws `Module not found` for app/admin/auth view files that other agents haven't created yet. Once those land, the public views will render cleanly via the existing lazy-imports. No changes needed here.
- `useApp().params` is the mechanism used for deep-linking; the landing page's "Emergency Assistance" button uses `navigate("support", { focus: "emergency" })` and SupportView scrolls to the emergency contact card if `params.focus === "emergency"`.
- I deliberately did NOT invent phone numbers anywhere — SupportView only renders what the API returns. The seed (src/lib/seed.ts) provides 4 emergency contacts with placeholder text like "Available via your unit's internal directory".
