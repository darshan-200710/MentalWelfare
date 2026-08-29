# CRPF MHS 
An AI-Assisted Wellbeing Platform for Armed Forces Personnel

A confidential, AI-assisted **wellbeing and early-support** platform for armed forces and uniformed-service personnel. Regular check-ins, daily journaling (text + voice), an AI-assisted companion, configurable risk monitoring, audited sensitive-access controls, and a secure admin console.

> This repository now also includes a standalone [`backend/`](backend/README.md) FastAPI service, Alembic migration, focused backend tests, and a full PostgreSQL/Redis Docker Compose stack. The existing Next.js application remains at repository root as the frontend/BFF implementation; its app routes preserve the current interface while the FastAPI service exposes the documented API contract for deployment integration.

> **Important:** CRPF MHS is an *AI-assisted wellbeing and early-support system*. It does **not** diagnose mental illness and does **not** replace qualified mental-health professionals. Any potentially high-risk situation surfaces human-support options and creates an internal alert for authorized personnel.

---

## Table of Contents
1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Tech Stack](#tech-stack)
5. [Project Structure](#project-structure)
6. [Quick Start](#quick-start)
7. [Development Credentials](#development-credentials)
8. [Environment Variables](#environment-variables)
9. [Database Setup](#database-setup)
10. [Running the App](#running-the-app)
11. [AI Provider Configuration](#ai-provider-configuration)
12. [Security Model](#security-model)
13. [RBAC & Permissions](#rbac--permissions)
14. [Testing the RBAC](#testing-the-rbac)
15. [Production Deployment](#production-deployment)
16. [Known Limitations](#known-limitations)
17. [Next Steps for Production](#next-steps-for-production)

---

## Overview

CRPF MHS helps personnel:
- perform regular wellbeing check-ins
- complete an initial wellbeing assessment
- maintain daily journals (text and voice)
- speak instead of typing
- receive supportive AI-assisted conversations
- identify possible indicators of increased stress or distress
- access professional / human support
- allow authorized personnel to monitor appropriate wellbeing indicators
- provide administrators with secure analytics and alerts

The platform enforces **least privilege**, **data minimization**, **consent tracking**, and **audit logging**. Internal wellbeing indicators are **operational**, not clinical diagnoses, and are never shown to the end user — only to roles with the `VIEW_RISK_INDICATOR` permission.

## Features

**Public site** — landing, about, how-it-works, resources, support, contact, privacy.
**Authentication** — email/password (scrypt hashing), session cookies, account lockout/rate-limiting, register/login/forgot/reset/verify flows, MFA-ready architecture, Google OAuth placeholder.
**Onboarding assessment** — 7-question configurable assessment stored in the DB; server-side scoring; raw score never shown to the user.
**User dashboard** — mood check-in, daily composer, streaks, quick actions, recent activity.
**Daily journal** — full CRUD, drafts, AI wellbeing-signal analysis on submit.
**Voice journal** — `MediaRecorder` capture → server-side STT (z-ai-web-dev-sdk) → editable transcript review → submit.
**AI companion** — multi-turn chat with a strict system prompt, deterministic safety layer (crisis escalation), voice output via TTS, conversation history.
**Risk engine** — deterministic rules layer combining assessment + journals + voice + AI signals + support requests → operational level (NORMAL..CRITICAL). The LLM never sets final risk.
**Alert system** — threshold-driven alerts (OPEN/ACKNOWLEDGED/IN_REVIEW/RESOLVED) with assignment.
**Admin console** — dashboard, personnel, person detail (with sensitive-access gating), risk monitoring, alerts, analytics, audit logs, settings.
**Support system** — configurable emergency contacts, support-request workflow.
**Resources** — DB-stored, categorised wellbeing resources.
**Consent** — versioned, per-purpose consent records.
**Audit logging** — every sensitive action recorded with actor, action, target, hashed IP, metadata.

## Architecture

```
Browser (React client)
   │  fetch (httpOnly session cookie)
   ▼
Next.js API Routes (server)
   │  ─ auth (scrypt + session), RBAC, audit logging
   │  ─ AI provider abstraction (Mock | ZAI)
   ▼
Prisma ORM  ────  SQLite (dev) / PostgreSQL (prod-ready schema)
   ▲
z-ai-web-dev-sdk  (LLM chat.completions / ASR audio.asr / TTS audio.tts)
```

The frontend **never** calls an AI provider directly. All AI calls go through FastAPI-style server routes that depend on the `AIProvider` interface — swapping providers is a one-line env change.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/AI.md`](docs/AI.md).

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | **Next.js 16** (App Router, Turbopack) |
| Language | **TypeScript 5** |
| Styling | **Tailwind CSS 4** + **shadcn/ui** (New York) |
| Database | **Prisma ORM** (SQLite in dev; schema is Postgres-ready) |
| State | **Zustand** (client) |
| Server state | **TanStack Query** |
| Forms | **React Hook Form** + **Zod** |
| Charts | **Recharts** |
| Icons | **lucide-react** |
| AI / Voice | **z-ai-web-dev-sdk** (LLM, ASR, TTS) — server-only |
| Auth | Custom session-cookie auth (scrypt hashing, httpOnly cookies) |
| Notifications | **sonner** |

> The requested Python/FastAPI/PostgreSQL/Redis stack is adapted to this Next.js environment (see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#adaptation-notes)). Every architectural principle — provider abstraction, RBAC, audit logging, risk engine, consent, least privilege — is preserved.

## Project Structure

```
.
├── prisma/
│   └── schema.prisma            # 18 models (User, Session, Assessment*, Journal, Voice, AI*, Risk*, Alert, Support, Consent, Audit, Resource, EmergencyContact)
├── src/
│   ├── app/
│   │   ├── page.tsx            # SPA view-router dispatcher (auth + role guards)
│   │   ├── layout.tsx
│   │   ├── globals.css         # calm teal design tokens
│   │   └── api/                # REST API routes (all wrapped with apiRoute for error->Response)
│   │       ├── auth/{login,register,logout,me}/route.ts
│   │       ├── journals/  journals/[id]/
│   │       ├── assessments/  assessments/history/
│   │       ├── voice/transcribe/
│   │       ├── ai/{chat,analyze-journal,conversations}/
│   │       ├── tts/
│   │       ├── support/  resources/  emergency-contacts/  consent/
│   │       ├── dashboard/  seed/
│   │       └── admin/{dashboard,personnel,personnel/[id],risk,alerts,alerts/[id],audit-logs,analytics}/
│   ├── lib/
│   │   ├── db.ts               # Prisma client (query logging OFF to save memory)
│   │   ├── auth.ts             # scrypt hashing, session tokens, requireAuth/requirePermission
│   │   ├── audit.ts            # audit logger (server-only)
│   │   ├── api-shared.ts       # ApiRequestError + apiRoute() wrapper + jsonError
│   │   ├── api.ts              # client fetcher
│   │   ├── store.ts            # Zustand (view router + auth + theme)
│   │   ├── types.ts            # all DTOs
│   │   ├── constants.ts       # RBAC permissions, levels, nav, AUDIT_ACTIONS, AUDIT_ACTION_LABELS
│   │   ├── seed.ts             # development seed data
│   │   ├── risk-engine.ts      # deterministic risk rules + alert creation
│   │   └── ai/
│   │       └── provider.ts     # AIProvider interface + MockAIProvider + ZAIAIProvider
│   ├── components/
│   │   ├── ui/                 # shadcn/ui (50+ components)
│   │   ├── shared/             # logo, level-pill, ui helpers, auth-bootstrap
│   │   ├── layout/             # public-navbar, public-footer, app-shell, admin-shell
│   │   └── views/
│   │       ├── public/         # Landing, About, HowItWorks, Resources, Support, Contact, Privacy
│   │       ├── auth/           # Login, Register, Forgot, Reset, Verify
│   │       ├── app/            # Assessment, Dashboard, DailyLog, VoiceJournal, AICompanion, History, Profile, Help, Settings
│   │       └── admin/          # AdminDashboard, Personnel, Person, Risk, Alerts, Analytics, Audit, Settings
│   └── ...
├── docs/                       # ARCHITECTURE, SECURITY, DATABASE, AI, PRIVACY, API, DEPLOYMENT
├── .env.example
└── README.md
```

## Quick Start

```bash
# 1. Install dependencies
bun install

# 2. Configure environment
cp .env.example .env
# edit .env — set DATABASE_URL (SQLite default works out of the box)

# 3. Set up the database
bun run db:generate
bun run db:push

# 4. Start the dev server
bun run dev   # http://localhost:3000

# 5. Seed development data (first time only)
curl -X POST http://localhost:3000/api/seed
```

Then open the **Preview Panel** (the app runs on port 3000 internally — use the Preview button, not `localhost`).

## FastAPI service and Docker

The standalone backend lives in [`backend/`](backend/README.md) and exposes its OpenAPI console at `http://localhost:8000/docs`.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
Set-Location backend
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Or use the full service stack after copying `.env.example` to `.env`:

```powershell
docker compose up --build
```

The FastAPI backend defaults to mock AI/STT output. It provides a server-owned provider abstraction, deterministic wellbeing safety rules, Argon2 hashing, JWT access tokens, rotated refresh sessions, and explicit RBAC dependencies. The current root Next.js interface retains its existing API/BFF routes for compatibility; integrating it against the FastAPI contract is a deployment migration rather than a silent replacement.

## Development Credentials

All accounts use the password **`CRPF MHS@2025`**. These are **development-only** fictional accounts.

| Email | Role | Notes |
|---|---|---|
| `admin@CRPF MHS.dev` | ADMIN | Sees analytics, audit logs, manages alerts — but **cannot** view journals/conversations (no clinical permission) |
| `pro@CRPF MHS.dev` | MENTAL_HEALTH_PROFESSIONAL | Has `VIEW_JOURNAL` / `VIEW_AI_CONVERSATION` / `VIEW_ASSESSMENT` (clinical access) |
| `supervisor@CRPF MHS.dev` | SUPERVISOR | Limited operational view |
| `user@CRPF MHS.dev` | USER (Personnel) | Onboarding complete |
| `sara@CRPF MHS.dev` | USER (Personnel) | `firstLogin=true` → triggers assessment onboarding |
| `daniel@CRPF MHS.dev`, `tom@CRPF MHS.dev`, `aisha@CRPF MHS.dev` | USER | Sample personnel with seeded journals/alerts |

## Environment Variables

See [`.env.example`](.env.example). Key variables:

```bash
DATABASE_URL=file:./db/custom.db   # SQLite (dev) or postgresql://... (prod)
AI_PROVIDER=zai                    # "zai" (real z-ai-web-dev-sdk) | "mock" (deterministic, no credentials)
AUDIT_IP_SALT=change-me            # salt for hashing IPs in audit logs
ALLOW_SEED=0                      # set to 1 to allow /api/seed in production
NODE_ENV=development
```

No AI provider API key is required — `z-ai-web-dev-sdk` is pre-provisioned in this environment. For other deployments, set `AI_PROVIDER=mock` to run fully offline.

## Database Setup

The schema is in `prisma/schema.prisma` (18 models, UUID/cuid IDs, indexes, foreign keys). See [`docs/DATABASE.md`](docs/DATABASE.md).

```bash
bun run db:generate   # generate Prisma client
bun run db:push       # apply schema to SQLite (non-destructive; --accept-data-loss)
bun run db:reset      # wipe + recreate (dev only)
```

## Running the App

```bash
bun run dev          # dev server on port 3000 (Turbopack)
bun run lint         # ESLint
```

Open the **Preview Panel** on the right (or click "Open in New Tab"). Do not navigate to `localhost:3000` directly — it's internal.

## AI Provider Configuration

The backend depends on the `AIProvider` interface (`src/lib/ai/provider.ts`), never on a vendor:

```
AIProvider
├── MockAIProvider   # deterministic, zero-credential (AI_PROVIDER=mock)
└── ZAIAIProvider    # real z-ai-web-dev-sdk (AI_PROVIDER=zai, default)
```

Methods: `chat()`, `analyzeJournal()`, `analyzeAssessment()`, `detectRiskSignals()`.

A **deterministic safety classifier** runs *before* the LLM on every user message and journal — it is the single source of truth for crisis escalation. The LLM never decides whether to escalate. See [`docs/AI.md`](docs/AI.md).

## Security Model

- **Passwords** hashed with **scrypt** (Node built-in, Argon2-equivalent strength). Never plaintext, never logged.
- **Sessions** — random 32-byte token, stored **hashed** in DB, httpOnly + SameSite=Lax cookie, 7-day expiry, revocable.
- **Account lockout** — 5 failed attempts → 15-minute lock.
- **RBAC** enforced on **every** sensitive backend endpoint via `requirePermission()`. Frontend hiding is cosmetic only.
- **Audit logging** — every sensitive read/write recorded with actor, action, target, hashed IP, metadata. Never logs passwords, API keys, or raw sensitive content beyond what the action requires.
- **Sensitive-access gating** — journals, AI conversations, and assessments require explicit permissions (`VIEW_JOURNAL`, `VIEW_AI_CONVERSATION`, `VIEW_ASSESSMENT`). An ADMIN does **not** automatically see clinical content.
- **AI prompt-injection defense** — user text is untrusted input; system prompt is owned by the backend; the LLM cannot override safety rules or execute tools from user text.
- **Rate limiting / brute-force defense** via account lockout.
- **Input validation** everywhere (Zod on both client and server).
- **File upload validation** — MIME allowlist + 10MB cap on voice uploads.

See [`docs/SECURITY.md`](docs/SECURITY.md).

## RBAC & Permissions

| Permission | USER | SUPERVISOR | MHP | ADMIN | SUPER_ADMIN |
|---|---|---|---|---|---|
| VIEW_USER_PROFILE | — | ✓ | ✓ | ✓ | ✓ |
| VIEW_RISK_INDICATOR | — | ✓ | ✓ | ✓ | ✓ |
| MANAGE_ALERTS | — | ✓ | ✓ | ✓ | ✓ |
| VIEW_ASSESSMENT (clinical) | — | — | ✓ | — | ✓ |
| VIEW_JOURNAL (clinical) | — | — | ✓ | — | ✓ |
| VIEW_AI_CONVERSATION (clinical) | — | — | ✓ | — | ✓ |
| MANAGE_USERS | — | — | — | ✓ | ✓ |
| VIEW_ANALYTICS | — | — | — | ✓ | ✓ |
| VIEW_AUDIT_LOGS | — | — | — | ✓ | ✓ |
| MANAGE_SYSTEM | — | — | — | ✓ | ✓ |

> Notice that **ADMIN cannot read journals or AI conversations** — that's intentional. Only MENTAL_HEALTH_PROFESSIONAL (and SUPER_ADMIN) get clinical access.

## Testing the RBAC

```bash
# USER should get 403 on every admin endpoint
curl -s -c /tmp/u.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@CRPF MHS.dev","password":"CRPF MHS@2025"}'
for ep in dashboard personnel risk alerts audit-logs analytics; do
  echo -n "$ep: "; curl -s -b /tmp/u.txt -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/admin/$ep
done   # → all 403

# ADMIN vs MENTAL_HEALTH_PROFESSIONAL sensitive access on the same person
# admin sees visible.journals=false; professional sees visible.journals=true + the entries
```

## Production Deployment

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md). Highlights:
- Switch `DATABASE_URL` to PostgreSQL (schema is ready).
- Set `NODE_ENV=production`, `ALLOW_SEED=0`.
- Enable HTTPS termination (Caddy/nginx).
- Rotate `AUDIT_IP_SALT` and session secrets.
- Configure real OAuth (Google OIDC) for SSO.
- Back up the database regularly; enable point-in-time recovery for Postgres.

## Known Limitations

- **Email sending** is mocked (forgot-password / verify-email show optimistic success). Wire a real SMTP/OAuth provider for production.
- **OAuth Google** login button is present but disabled (placeholder) — implement with NextAuth.js or your OIDC library and real client credentials.
- **MFA** UI is scaffolded (toggle + "not configured" state); TOTP enrolment/verification backend needs wiring for production.
- **Real-time** alert push to admin is not implemented (admin polls). WebSocket/socket.io mini-service pattern is available if needed.
- The assessment uses a fixed 7-question seed set; the engine fully supports DB-driven question banks/versioning for richer instruments.
- Single-instance deployment (no horizontal scaling / Redis caching layer). For scale, add Redis + a session store.

## Next Steps for Production

1. Replace mock email with SMTP/OAuth email verification + password reset.
2. Wire real Google OIDC (NextAuth.js) for SSO.
3. Implement TOTP MFA enrolment + verification.
4. Move DB to PostgreSQL + run Alembic-style Prisma migrations.
5. Add Redis for session store + rate-limit counters + alert fan-out.
6. Add automated tests (Jest/Vitest) for auth, RBAC, risk engine, assessment scoring.
7. Enable structured logging + metrics (OpenTelemetry).
8. Conduct a third-party security review before handling real personnel data.
9. Configure real emergency/support contact details (currently DB-driven placeholders).

---

**If you are in immediate danger, contact your local emergency services.** CRPF MHS is a support tool, not a crisis line.
