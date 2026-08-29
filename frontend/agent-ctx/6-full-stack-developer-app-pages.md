# Agent Work Record — Task ID 6 (Authenticated User App Pages)

**Agent:** full-stack-developer (app pages)
**Task:** Build 9 authenticated user view components for the Sentinel Wellbeing Platform.

## Scope
Created files ONLY in `/home/z/my-project/src/components/views/app/`:

| File | View key | Purpose |
|------|----------|---------|
| `AssessmentView.tsx` | `assessment` | First-login onboarding check-in: intro screen → fetches `GET /api/assessments/current`, one-question-at-a-time UI with Progress bar + radio-card options, Back/Skip/Next navigation. `POST /api/assessments` on final submit. Server computes score (never shown); UI shows "Your check-in has been recorded." Completion screen with reassurance + "Go to dashboard" + disclaimer. Re-take path when `user.onboardingComplete` already true. |
| `DashboardView.tsx` | `dashboard` | `GET /api/dashboard`. Time-of-day greeting + firstName. Mood selector (MOODS). Quick journal composer (Textarea + mood + Save Draft / Submit Entry → `POST /api/journals`). Quick-actions grid (Daily Log, AI Companion, Voice Journal, Assessment, History, Resources, Get Support). 4 stat cards (streak, check-ins, journals, voice notes). Recent activity list. `needsOnboarding` banner. Skeleton + error retry. |
| `DailyLogView.tsx` | `daily-log` | Two-column responsive layout. Left: composer (MoodPicker + Textarea + Save Draft / Submit). Right: scrollable history list (`GET /api/journals`) with mood/date/status/preview + Edit/Delete. Edit via Dialog (`PUT /api/journals/[id]`). Delete via AlertDialog (`DELETE /api/journals/[id]`). Privacy note. Loading/empty/error states. |
| `VoiceJournalView.tsx` | `voice-journal` | Big primary record button → `MediaRecorder` (auto-selects webm/opus → webm → mp4 → ogg). Recording timer (mm:ss), `.rec-pulse` indicator, Stop button. On stop: blob → dataURL → `POST /api/voice/transcribe`. "Transcribing…" spinner. Then editable Textarea with transcript; Submit (`POST /api/journals`) or Cancel — NEVER auto-submits. Graceful mic-permission errors. Privacy note. Recent voice notes from `/api/dashboard`. Mobile-first big tap targets. |
| `AICompanionView.tsx` | `ai-companion` | Full-height chat. Sidebar: conversation list (`GET /api/ai/conversations`) + New chat. Main: scrollable messages with user-right/assistant-left bubbles, `.typing-dot` indicator, auto-scroll. Empty state with suggested prompts. Input: Textarea (Enter to send) + mic button (MediaRecorder → transcribe → fill input) + send (`POST /api/ai/chat`). Speak button on assistant messages → `POST /api/tts` (WAV blob) → plays via `Audio`. `riskFlag` → amber support panel above composer with "Get support now" → support. Disclaimer "AI-assisted companion — not a clinician, not a diagnosis." |
| `HistoryView.tsx` | `history` | Tabs: Journals / Voice / Check-ins / Chats. Each fetches its source. List of cards with formatted dates, status badges, mood emojis, previews. Empty states with CTAs. NEVER exposes internal wellbeing level — assessment tab shows only "Check-in recorded on [date]" with privacy note. |
| `ProfileView.tsx` | `profile` | Identity card + 6-field info grid. Cards: Password (Coming soon), MFA (Switch + Coming soon), Sessions (mock), Notifications (toggles), Data preferences (toggles). Consent management: `GET /api/consent` → list with granted/withdrawn per purpose; Grant/Withdraw → AlertDialog confirm → `POST /api/consent`. Consent history list. Privacy policy link. |
| `HelpView.tsx` | `help` | Quick-link cards. Searchable FAQ accordion (8 Q&As). Contact support card with 3 channels + "Open support" CTA. |
| `SettingsView.tsx` | `settings` | Appearance: theme picker (Light/Dark/System) wired to `store.setTheme`, font-size slider applying via `document.documentElement.style.fontSize`, accessibility toggles (Reduce motion, High contrast). Notifications card (5 toggles, persisted to localStorage). Privacy & data card linking to privacy policy + manage consent. Used lazy `useState` initializers (no setState-in-effect lint violation). |

## Key Design Decisions
1. **Calm teal palette** — only `bg-primary`/`text-primary`/`bg-card`/`bg-muted` Tailwind tokens; NO indigo or blue.
2. **Never expose internal risk level/score** — dashboard, daily-log, history (assessment tab), and AI companion all omit any reference to internal indicators; user-facing messaging is deliberately vague ("Your check-in has been recorded", "Check-in recorded on [date]").
3. **Disclaimer placement** — "AI-assisted wellbeing system — not a medical diagnosis" on Assessment intro + completion; "AI-assisted companion — not a clinician, not a diagnosis" on AI Companion (empty state + composer footer).
4. **MediaRecorder flow shared** between VoiceJournal and AI Companion mic input — auto-detects supported mime, handles `NotAllowedError`/`NotFoundError`/empty-blob, cleans up stream tracks on unmount.
5. **Optimistic UI for chat** — user message + pending assistant bubble rendered immediately; replaced with real response on success or rolled back on error.
6. **Accessibility** — ARIA labels on every interactive control, `aria-pressed` on toggle buttons, `sr-only` legends, focus-visible rings everywhere, ≥44px tap targets on voice/chat inputs.
7. **Mobile-first responsive** — single column on small screens, two-column grids on sm/lg, sidebar hidden on small AI Companion with New button in header instead.
8. **Loading/error/empty states everywhere** — `Spinner` / `EmptyState` from `@/components/shared/ui`, custom `Skeleton` layouts, error retry buttons, sonner toasts for all async feedback.
9. **TanStack Query NOT used** — chose `useEffect + useState` for data fetching to keep bundle small and avoid introducing another dependency layer; all states (loading/error/data/empty) handled explicitly.
10. **Voice journal review screen** — explicit editable Textarea prefilled with transcript; user MUST press Submit to persist. Matches the API contract that `/api/voice/transcribe` already creates a `VoiceEntry` (analysis + risk-engine trigger happens server-side); user-facing flow is "transcribe → review → save as journal".

## Lint status
- All 9 files lint cleanly (`bun run lint`).
- 2 pre-existing lint errors remain in `src/lib/audit.ts` (line 11) and `src/lib/auth.ts` (line 89) — `@typescript-eslint/no-require-imports`. Out of scope (outside `src/components/views/app/`), untouched.

## Notes for downstream agents
- The home route (`/`) currently 500s because `AdminAuditView.tsx` (Task 7) imports `@/lib/audit` which uses `next/headers` (server-only). That is a Task 7 fix. My app views have no such imports — they only touch API routes via `@/lib/api`.
- The `api.blob(path, opts)` helper can be called with `method: "POST"` + `json: {...}` to do an authenticated POST that returns a binary blob (used for `/api/tts`).
- `/api/auth/me` returns `{ user: SafeUser | null }` — used in AssessmentView to refresh the user after onboarding completion.
- App views assume `AppShell` wraps them — they start their own top padding (`py-6 sm:py-8`) and don't include the sidebar/topbar themselves.
