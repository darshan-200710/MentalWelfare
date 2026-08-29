# Architecture

> Sentinel is an AI-assisted wellbeing and early-support platform for armed forces personnel. This document describes the runtime architecture, the request lifecycle, the SPA view-router, the data flows for each module, and how the originally-requested FastAPI/PostgreSQL/Redis stack was adapted to the existing Next.js 16 environment while preserving every architectural principle.

All file paths in this document are relative to the repository root (`/home/z/my-project`).

> **FastAPI deployment service:** The repository now additionally contains `backend/`, a standalone FastAPI/SQLAlchemy/Alembic service with PostgreSQL and Redis Compose services. The root Next.js app remains the current frontend/BFF implementation; `backend/` exposes the documented deployment API and is deliberately isolated so it can be adopted without breaking the existing user interface. See [API.md](API.md) and [DEPLOYMENT.md](DEPLOYMENT.md).

---

## 1. System architecture

```
                          ┌──────────────────────────────────────────┐
                          │            Browser (React client)         │
                          │  Zustand view-router · TanStack-style     │
                          │  fetch via src/lib/api.ts (cookie auth)   │
                          └────────────────┬─────────────────────────┘
                                           │  https — httpOnly cookie "sw_session"
                                           ▼
        ┌──────────────────────────────────────────────────────────────────────┐
        │                       Next.js 16 (single app)                        │
        │                                                                      │
        │   src/app/page.tsx            ← SPA view-router dispatcher            │
        │   src/app/api/**/route.ts     ← REST handlers (one per resource)     │
        │                                                                      │
        │   ┌──────────────────────────────────────────────────────────────┐   │
        │   │                  Cross-cutting concerns                     │   │
        │   │   src/lib/auth.ts          → requireAuth / requirePermission │   │
        │   │   src/lib/audit.ts         → logAudit (server-only)          │   │
        │   │   src/lib/api-shared.ts    → apiRoute wrapper + ApiRequestError │  │
        │   │   src/lib/constants.ts     → PERMISSIONS, AUDIT_ACTIONS       │   │
        │   │   src/lib/risk-engine.ts   → deterministic risk rules          │   │
        │   │   src/lib/ai/provider.ts   → AIProvider abstraction           │   │
        │   └──────────────────────────────────────────────────────────────┘   │
        │                                                                      │
        │   src/lib/db.ts               → Prisma client (singleton)           │
        └─────────────┬───────────────────────────┬──────────────────────────┘
                      │                            │
                      ▼                            ▼
        ┌──────────────────────────┐   ┌──────────────────────────────┐
        │  Prisma ORM              │   │  z-ai-web-dev-sdk            │
        │  SQLite (dev)            │   │  (server-only — never client)│
        │  PostgreSQL-ready schema  │   │  • chat.completions.create   │
        │  18 models                │   │  • audio.asr.create          │
        └──────────────────────────┘   │  • audio.tts.create          │
                                       └──────────────────────────────┘
```

Three hard rules govern the picture above:

1. **The client never talks to AI providers directly.** Every AI call goes through a Next.js API route that depends on the `AIProvider` interface (`src/lib/ai/provider.ts`).
2. **Every sensitive endpoint calls `requirePermission(...)`.** RBAC is enforced in `src/lib/auth.ts`; frontend hiding in `src/app/page.tsx` is convenience only.
3. **The deterministic safety classifier is the only thing that can trigger an escalation** from a user message. The LLM never decides whether to escalate (see `src/lib/ai/provider.ts::detectRiskSignals`).

---

## 2. Request lifecycle (authenticated call)

A representative `POST /api/journals` call walks the stack as follows:

1. **Client** (`src/lib/api.ts`) issues `fetch('/api/journals', { method: 'POST', credentials: 'include', body: JSON.stringify({ mood, content }) })`. The `sw_session` cookie travels automatically.
2. **Edge / route handler wrapper.** The exported handler is `apiRoute(_POST)` (`src/app/api/journals/route.ts`), so any thrown `ApiRequestError` becomes a proper `{ error, code }` JSON response with its status (`src/lib/api-shared.ts`).
3. **Body validation.** `z.object({ mood, content, status }).safeParse(body)` — invalid bodies return `422` with the first Zod issue message.
4. **Authentication.** `requireAuth()` reads the cookie, hashes the token with SHA-256, looks up the `Session` row in Prisma, rejects if missing / revoked / expired, and returns the `SafeUser` plus the full Prisma `User` row.
5. **Authorisation / RBAC.** Sensitive routes call `requirePermission(perm)`, which calls `requireAuth()` then `hasPermission(role, perm)`. On failure it writes an `unauthorized_access_attempt` audit entry and throws `ApiRequestError(403, "FORBIDDEN")`.
6. **Domain logic.** The handler:
   - calls `getAIProvider().analyzeJournal(content)` (the provider may call `z-ai-web-dev-sdk` or the mock),
   - persists the journal via Prisma,
   - if `analysis.wellbeing_signal ∈ {ELEVATED, HIGH, CRITICAL}` it calls `triggerRiskFromContent(...)` (`src/lib/risk-engine.ts`), which persists a `RiskEvent` and may auto-create an `Alert`,
   - writes a `journal_submitted` (or `journal_draft_saved`) audit entry.
7. **Response.** `Response.json({ journal: JournalDTO })` — the handler returns a serialisable DTO; the raw Prisma row (with `analysisJson` as a JSON string) is mapped through a `toDTO` helper.

The same wrapper handles every admin endpoint, every `[id]` route, and every AI / voice / TTS route — there are 26 route files / 30 handlers all converted to the `apiRoute` pattern (see Task 3-fix in `worklog.md`).

---

## 3. The SPA view-router

Per the environment rules, the project exposes **exactly one HTTP route** (`/`). The whole experience is a single-page app whose views are selected by a Zustand store, not by `next/router`.

### Store

`src/lib/store.ts` holds:

- `user: SafeUser | null` — current authenticated user (mirrored from `/api/auth/me`).
- `view: View` — the active view key (e.g. `"dashboard"`, `"admin-personnel"`, `"ai-companion"`).
- `params: Record<string, unknown>` — per-view params (deep-linkable filters, focus targets).
- `theme`, `fontSize`, accessibility toggles.
- `navigate(view, params?)` — the only way to change views; pushes `view` + `params` to history so the browser back button still works.

### Dispatcher

`src/app/page.tsx` is the dispatcher. It:

1. `lazy()`-imports every view (Turbopack code-splits each into its own chunk):
   - 7 public views (`src/components/views/public/`)
   - 5 auth views (`src/components/views/auth/`)
   - 9 app views (`src/components/views/app/`)
   - 8 admin views (`src/components/views/admin/`)
2. Renders the appropriate shell (`PublicNavbar`/`PublicFooter`, `AppShell`, or `AdminShell`) based on which view bucket the active `view` falls into.
3. Applies **client-side guards** inside a `useEffect`:
   - unauthenticated user on an app/admin view → redirect to `login`;
   - authenticated user lingering on a public/auth view → send to `dashboard` (or `assessment` if `onboardingComplete` is false);
   - app view but `!user.onboardingComplete` and `view !== "assessment"` → send to `assessment`;
   - admin view without an authorised role (`ADMIN`, `SUPER_ADMIN`, `MENTAL_HEALTH_PROFESSIONAL`, `SUPERVISOR`) → send to `dashboard`.

   These guards are UX-only. The backend re-enforces everything through `requireAuth`/`requirePermission`, so a tampered client cannot read sensitive data.

### Auth bootstrap

`src/components/shared/auth-bootstrap.tsx` runs once on mount: it calls `GET /api/auth/me`, populates `user` in the store, and flips a `bootstrapped` flag so the dispatcher can show a `FullSpinner` instead of flickering the wrong shell.

---

## 4. Adaptation notes (requested stack → actual stack)

The original spec called for a Python / FastAPI / PostgreSQL / Redis backend with a separate React-Vite frontend. The sandbox environment provides Next.js 16 (App Router), Prisma + SQLite, and `z-ai-web-dev-sdk`. The adaptation preserves every architectural principle while collapsing the topology into one deployable Next.js app:

| Requested component | Adapted to | Principle preserved |
|---|---|---|
| FastAPI service layer | Next.js API routes (`src/app/api/**/route.ts`) | Same REST contract; same separation between transport and domain logic; same `apiRoute` wrapper that maps domain exceptions to HTTP status codes (the FastAPI `HTTPException` analogue). |
| SQLAlchemy / Pydantic models | Prisma schema (`prisma/schema.prisma`, 18 models) + Zod schemas per route | Same typed boundary; same parameterised queries (Prisma parameterises by default → no SQLi). |
| PostgreSQL | SQLite in dev (file at `db/custom.db`); schema is Postgres-ready (no SQLite-specific column types beyond `String`/`Int`/`Boolean`/`DateTime`) | Same relational design, FKs, indexes, `cuid` IDs. Swap `DATABASE_URL` to a Postgres URL in production — no code changes. |
| Redis (sessions, rate-limit, queues) | DB-backed sessions (`Session` table), in-process account-lockout counters on the `User` row | Same primitives; horizontal scale requires reintroducing Redis (see `docs/DEPLOYMENT.md`). |
| OAuth / SMTP / MFA | UI placeholders + env slots in `.env.example` | The auth module is structured so OAuth (NextAuth.js v4 is in `package.json`), SMTP, and TOTP can be added without touching route handlers. |
| Frontend SPA (React-Vite) | Next.js client components (`"use client"`) lazy-loaded by `src/app/page.tsx` | Same SPA feel; same `React.lazy` code-splitting; same Zustand store; same RBAC-aware navigation. |
| Background workers / risk engine | The risk engine is invoked synchronously from inside the API route that just persisted the signal (e.g. `POST /api/journals` calls `triggerRiskFromContent`). | The risk rules, the `RiskEvent`/`Alert` write paths, and the audit entries are identical to what a worker would do; the only difference is the call site. A queue can be slotted in later without changing the engine. |

### Principles preserved 1:1

- **Provider abstraction.** `AIProvider` interface in `src/lib/ai/provider.ts` — `MockAIProvider` and `ZAIAIProvider` are interchangeable via `AI_PROVIDER` env var.
- **RBAC.** `PERMISSIONS` map in `src/lib/constants.ts`; `requirePermission` in `src/lib/auth.ts` is the single chokepoint.
- **Audit logging.** `logAudit` in `src/lib/audit.ts` writes a row on every sensitive action; IPs are HMAC-hashed with `AUDIT_IP_SALT`.
- **Risk engine.** `src/lib/risk-engine.ts` combines signals deterministically; the LLM never sets the final level.
- **Consent.** `ConsentRecord` table + `POST /api/consent`; `CONSENT_VERSION` in `src/lib/constants.ts` supports versioned re-consent.
- **Least privilege.** The `ADMIN` role deliberately has *no* clinical permissions — see the table in `README.md` §RBAC. Journals, AI conversations, and assessments can only be read by `MENTAL_HEALTH_PROFESSIONAL` and `SUPER_ADMIN`, and every such read writes a `SENSITIVE_ACCESS` audit entry.

---

## 5. Data flow per module

### 5.1 Assessment

```
AssessmentView
   │  GET /api/assessments          (list active AssessmentQuestion rows)
   │  POST /api/assessments {answers:[{questionId, questionCode, value}]}
   ▼
src/app/api/assessments/route.ts
   │  • requireAuth()
   │  • look up scoring for each answer from the DB (client scores are NEVER trusted)
   │  • create AssessmentSession + AssessmentAnswer rows
   │  • getAIProvider().analyzeAssessment(scored)  → {totalScore, normalizedScore, level, signals}
   │      (this method is deterministic; the LLM is not asked to set risk)
   │  • persist AssessmentResult
   │  • if level ∈ {ELEVATED, HIGH, CRITICAL} → triggerRiskFromContent({source:"assessment"})
   │  • mark user.onboardingComplete = true
   │  • audit assessment_submitted
   │  • return { ok:true, message:"Your check-in has been recorded." }   ← raw score NEVER returned
```

The raw score and `wellbeingLevel` are stored on `AssessmentResult` and only surfaced to authorised viewers via `/api/admin/personnel/[id]` (which gates them behind `VIEW_ASSESSMENT`).

### 5.2 Journal

```
DailyLogView / DashboardView composer
   │  POST /api/journals { mood?, content, status:"DRAFT"|"SUBMITTED" }
   ▼
src/app/api/journals/route.ts
   │  • requireAuth()
   │  • Zod-validate body (content 1..10000 chars)
   │  • if status === "SUBMITTED":
   │        analysis = await getAIProvider().analyzeJournal(content)
   │        wellbeingLevel = analysis.wellbeing_signal
   │  • persist DailyJournal (analysisJson cached as JSON string)
   │  • if wellbeingLevel ∈ {ELEVATED, HIGH, CRITICAL}:
   │        triggerRiskFromContent({source:"journal", level, confidence, signals, reason})
   │  • audit journal_submitted | journal_draft_saved
   │  • return JournalDTO
```

`PUT /api/journals/[id]` re-runs analysis when the entry transitions to `SUBMITTED` or its content changes; `DELETE` is owner-only.

### 5.3 AI chat

```
AICompanionView
   │  POST /api/ai/chat { message, conversationId? }
   ▼
src/app/api/ai/chat/route.ts
   │  • requireAuth()
   │  • Zod-validate (message 1..4000 chars)
   │  • get-or-create AIConversation (title = first 60 chars of message)
   │  • persist the user's AIMessage
   │  • build history (last 20 messages, system prompt NOT from client)
   │  • result = await getAIProvider().chat(history)
   │       └─ inside provider:
   │          1. detectRiskSignals(message)            ← deterministic, single source of truth
   │          2. if highRisk → return SAFETY_MESSAGE + riskFlag:true  (LLM never called)
   │          3. otherwise call zai.chat.completions.create({messages:[systemPrompt, ...history]})
   │          4. detectRiskSignals(modelOutput)       ← defense-in-depth re-scan
   │          5. return { content, riskFlag }
   │  • persist assistant AIMessage (riskFlag, optional safetyMessage metadata)
   │  • if result.riskFlag:
   │        triggerRiskFromContent({source:"ai_chat", level:"HIGH", confidence:0.9})
   │        audit ai_safety_triggered
   │  • audit ai_chat
   │  • return { conversationId, message, userMessageId, riskFlag, safetyMessage }
```

### 5.4 Voice journal

```
VoiceJournalView (MediaRecorder in browser)
   │  POST /api/voice/transcribe { audio:base64, mime, durationSec }
   ▼
src/app/api/voice/transcribe/route.ts
   │  • requireAuth()
   │  • Zod-validate
   │  • MIME allowlist + 10 MB cap (415 BAD_MIME / 413 TOO_LARGE on violation)
   │  • base64-decode + size check
   │  • zai.audio.asr.create({ file_base64 }) → transcript   (fallback: deterministic mock)
   │  • analysis = await getAIProvider().analyzeJournal(transcript)
   │  • persist VoiceEntry (transcript, editedTranscript, analysisJson, wellbeingLevel)
   │  • if wellbeingLevel ∈ {ELEVATED, HIGH, CRITICAL}:
   │        triggerRiskFromContent({source:"voice"})
   │  • audit voice_transcribe
   │  • return { id, transcript, durationSec, wellbeingLevel }
   ▼
client UI shows the transcript in an editable Textarea
   │  user reviews/edits, then Submit → POST /api/journals (creates a DailyJournal from the transcript)
```

The voice flow **never** auto-submits — the user always sees the transcript and confirms.

### 5.5 TTS (voice output for AI companion)

`POST /api/tts { text }` (≤1024 chars) → `zai.audio.tts.create({ input, voice:"tongtong", speed:1.0, response_format:"wav", stream:false })` → returns a WAV blob with `Content-Type: audio/wav`. The client plays it via `new Audio(blobURL)`. Falls back to `503 TTS_UNAVAILABLE` on any SDK error.

---

## 6. Risk engine internals

`src/lib/risk-engine.ts` is a pure rules layer — no LLM, no I/O outside Prisma.

### Inputs (`RiskInput`)

| Field | Source | Weight |
|---|---|---|
| `assessmentScore` (0..100) | latest `AssessmentResult.normalizedScore` | ×0.35 |
| `recentJournalLevels[]` | last 5 submitted `DailyJournal.wellbeingLevel` (max value used) | ×0.30 |
| `recentVoiceLevels[]` | last 3 `VoiceEntry.wellbeingLevel` (max value used) | ×0.15 |
| `aiConversationRiskCount` | count of `AIMessage` with `riskFlag=true` | ×0.10 (capped at 20) |
| `openSupportRequests` | count of `SupportRequest` with `status="OPEN"` | ×0.10 (capped at 15) |

`LEVEL_TO_NUM` maps `NORMAL..CRITICAL` → `8, 22, 50, 70, 85, 95`. The summed score is clamped to 0..100 and run through `scoreToLevel` (`src/lib/constants.ts`) → `NORMAL | LOW | MODERATE | ELEVATED | HIGH | CRITICAL`.

### Outputs

- A `RiskEvent` row is persisted with `level`, `source`, `confidence`, `signalsJson`, `reason`.
- An `alert_created` audit entry is written.
- **Auto-alert** only fires when `level ∈ {ELEVATED, HIGH, CRITICAL}` AND no open/acknowledged/in-review alert for the same user exists within the last 24h (de-duplication).
- `recomputeUserRisk(userId)` is the periodic variant — it does **not** auto-alert (avoids spam); it just records the new state.
- `triggerRiskFromContent(...)` is the explicit variant — it **does** auto-alert. Called from the journals, voice, AI-chat, and assessment routes.

### Who sees the level

The end user never sees their own `wellbeingLevel` or score. Only authorised roles with `VIEW_RISK_INDICATOR` see it — via `/api/admin/dashboard`, `/api/admin/personnel/[id]`, and `/api/admin/risk`.

---

## 7. Module boundaries

```
src/
├── app/
│   ├── page.tsx                ← SPA dispatcher (auth + role guards)
│   ├── layout.tsx, globals.css
│   └── api/                    ← one folder per resource, route.ts each
│       ├── auth/{login,register,logout,me}/route.ts
│       ├── journals/route.ts + journals/[id]/route.ts
│       ├── assessments/route.ts + assessments/history/route.ts
│       ├── voice/transcribe/route.ts
│       ├── ai/{chat,analyze-journal,conversations}/route.ts
│       ├── tts/route.ts
│       ├── support/, resources/, emergency-contacts/, consent/, dashboard/, seed/
│       └── admin/{dashboard,personnel,personnel/[id],risk,alerts,alerts/[id],audit-logs,analytics}/route.ts
│
├── lib/                        ← cross-cutting concerns (no React)
│   ├── db.ts                   ← Prisma client (singleton, query log OFF)
│   ├── auth.ts                 ← scrypt, sessions, requireAuth/requirePermission, lockout
│   ├── audit.ts                ← logAudit (server-only, HMAC-hashed IPs)
│   ├── api-shared.ts           ← ApiRequestError + apiRoute wrapper + jsonError
│   ├── api.ts                  ← client fetcher (throws ApiRequestError)
│   ├── store.ts                ← Zustand (view router + auth + theme)
│   ├── types.ts                ← DTOs (SafeUser, JournalDTO, AlertDTO, ...)
│   ├── constants.ts            ← PERMISSIONS, LEVEL_META, AUDIT_ACTIONS, nav
│   ├── seed.ts                 ← dev-only fictional seed data
│   ├── risk-engine.ts          ← deterministic rules + recordRiskEvent + recomputeUserRisk
│   └── ai/provider.ts          ← AIProvider interface + Mock + ZAI providers + safety classifier
│
├── components/
│   ├── ui/                     ← shadcn/ui (50+ primitives)
│   ├── shared/                 ← logo, level-pill, ui helpers, auth-bootstrap
│   ├── layout/                 ← public-navbar, public-footer, app-shell, admin-shell
│   └── views/
│       ├── public/             ← 7 public views
│       ├── auth/               ← 5 auth views + AuthShell (PasswordInput, PasswordStrength)
│       ├── app/                ← 9 authenticated-user views
│       └── admin/               ← 8 admin views + _shared helpers
│
└── prisma/schema.prisma        ← 18 models
```

The dependency direction is strictly: `views → store + api + types + constants`, `api routes → lib (auth, audit, risk-engine, ai/provider, db)`, `lib → nothing in app/components`. The `ai/provider.ts` module is the only thing that imports `z-ai-web-dev-sdk`; no other file does, so swapping the AI vendor only touches one file.

---

## 8. Honest limitations

- **No background workers.** Risk recomputation runs inline on the request that produced a signal; there is no nightly sweep. A cron / queue is a documented next step (`docs/DEPLOYMENT.md`).
- **No real-time push to admin.** Admin views poll their endpoints. The WebSocket mini-service pattern (see `examples/websocket/`) is available if push is needed.
- **Single-instance.** No horizontal scaling story out of the box; session storage is the DB, not Redis.
- **Email + OAuth + MFA are placeholders.** The hooks exist; the integrations are not wired (see `README.md` §Known Limitations).
- **Two pre-existing Prisma field-name bugs.** `/api/admin/analytics` and `/api/assessments/history` may 500 due to a `createdAt`-vs-`startedAt` mismatch in one of their Prisma queries (flagged in Task 3-fix worklog). The `apiRoute` wrapper catches and JSON-encodes these 500s cleanly, but the underlying queries still need fixing.
