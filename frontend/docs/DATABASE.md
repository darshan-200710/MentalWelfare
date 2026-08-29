# Database

> The Sentinel schema is defined in `prisma/schema.prisma` — **18 Prisma models**. This document covers each model's purpose, key fields, relations, indexes, the rationale for SQLite-style `String` enum columns, the cuid/UUID ID strategy, timestamps, the seed data, migration strategy, and backup guidance.

The dev datasource is SQLite (`db/custom.db`). The schema is deliberately **PostgreSQL-ready** — no SQLite-specific column types are used, so swapping `DATABASE_URL` to a Postgres URL works without code changes.

---

## 1. Why these design choices

### String columns for enums

SQLite has no native `ENUM` type. To stay portable across SQLite (dev) and PostgreSQL (prod), every enum-like column is a `String` and is validated in the application layer via TypeScript unions (`src/lib/types.ts`) + Zod schemas at every API boundary. The values mirrored in the schema comments:

```prisma
role        String @default("USER")  // USER|SUPERVISOR|MENTAL_HEALTH_PROFESSIONAL|ADMIN|SUPER_ADMIN
status      String @default("ACTIVE") // ACTIVE|LOCKED|SUSPENDED|PENDING_VERIFICATION
mood        String?                  // great|good|okay|low|rough
wellbeingLevel String?               // NORMAL|LOW|MODERATE|ELEVATED|HIGH|CRITICAL
severity    String                    // LOW|MODERATE|HIGH|CRITICAL
alertStatus String @default("OPEN")   // OPEN|ACKNOWLEDGED|IN_REVIEW|RESOLVED
```

For a Postgres deployment you may migrate these to native `enum` types via a `prisma migrate` if you prefer DB-level enforcement — but the app layer already enforces them.

### cuid / UUID-style external IDs

Every model's `id` is `@id @default(cuid())`. cuids are:

- Collision-resistant across hosts (good for distributed writes).
- URL-safe (no `/` or `+` characters) — important for `[id]` routes.
- Opaque to the client (no sequential integers that leak row counts or enable enumeration attacks).

The internal Prisma relations use the same cuids as foreign keys.

### Timestamps

- `createdAt DateTime @default(now())` on every mutable row.
- `updatedAt DateTime @updatedAt` on rows that change (`User`, `DailyJournal`, `AIConversation`, `Alert`, `AssessmentQuestion`).
- The `AssessmentSession`/`RiskEvent`/`AuditLog`/`AssessmentAnswer`/`AIMessage`/`Notification`/`ConsentRecord`/`SupportRequest`/`VoiceEntry` rows are append-only — they have `createdAt` only.

### Soft delete vs hard delete

- **Journals** are hard-deleted (`DELETE /api/journals/[id]`). The owner can wipe an entry; the audit log retains the fact that a `journal_deleted` happened (with `targetId`), but the content is gone.
- **Users** are never hard-deleted in the current build — deactivating means flipping `status = SUSPENDED`. Hard delete + anonymisation is a documented next step (see `docs/PRIVACY.md` §User rights).
- **Audit logs** are never deleted — they're the forensic record. Retention is configurable (see Backup).

### Cascading deletes

`User` cascades to: `Session`, `AssessmentSession` (→ `AssessmentAnswer`, `AssessmentResult`), `DailyJournal`, `VoiceEntry`, `AIConversation` (→ `AIMessage`), `RiskEvent`, `Alert` (both as user and as assignee), `SupportRequest` (both as requester and assignee), `ConsentRecord`, `Notification`, `AuditLog` (as actor — but with `onDelete: SetNull` so audit entries survive user deletion; only the `actorId` is nulled).

---

## 2. The 18 models

### Auth & identity

#### `User`
Central identity record.

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | PK |
| `email` | String | `@unique` |
| `name` | String? | Display name |
| `serviceNumber` | String? | Military/personnel identifier (data-minimised) |
| `unit` | String? | e.g. "1st Battalion" |
| `rank` | String? | e.g. "Corporal" |
| `role` | String | `USER` (default) \| `SUPERVISOR` \| `MENTAL_HEALTH_PROFESSIONAL` \| `ADMIN` \| `SUPER_ADMIN` |
| `status` | String | `ACTIVE` \| `LOCKED` \| `SUSPENDED` \| `PENDING_VERIFICATION` |
| `passwordHash` | String? | `scrypt$...` format; null for OAuth-only accounts |
| `passwordResetAt` | DateTime? | |
| `mfaEnabled` | Boolean | Default false |
| `mfaSecret` | String? | TOTP secret (next step to wire) |
| `firstLogin` | Boolean | True until first assessment |
| `onboardingComplete` | Boolean | True after the initial assessment is submitted |
| `emailVerified` | Boolean | |
| `failedLoginAttempts` | Int | Brute-force counter |
| `lockedUntil` | DateTime? | Account lockout expiry |
| `createdAt`, `updatedAt`, `lastLoginAt`, `lastActiveAt` | DateTime | |

Relations: 1-to-many with `Session`, `AssessmentSession`, `DailyJournal`, `VoiceEntry`, `AIConversation`, `RiskEvent`, `Alert` (two: as user, as assignee), `SupportRequest` (two), `ConsentRecord`, `AuditLog` (as actor), `Notification`.

#### `Session`
A single active browser session.

| Field | Notes |
|---|---|
| `id` (cuid) | PK |
| `userId` | FK → User |
| `tokenHash` | `@unique` — SHA-256 of the random 32-byte cookie token |
| `userAgent` | String? (truncated to 255) |
| `ipHash` | String? (32-char SHA-256 prefix of the raw IP) |
| `expiresAt` | DateTime — 7 days from creation |
| `revokedAt` | DateTime? — set on logout |
| `createdAt` | DateTime |

Index: `@@index([userId])`. Cascade on user delete.

### Assessment engine

#### `AssessmentQuestion`
DB-driven question bank (the engine supports arbitrary questions / versions; the seed ships 7).

| Field | Notes |
|---|---|
| `code` | `@unique` — e.g. `Q1_SLEEP` |
| `questionText` | String |
| `questionType` | `single_choice` \| `multi_choice` \| `scale` \| `text` (string-validated) |
| `options` | JSON string `[{value, label, score}]` |
| `scoringMeta` | JSON `{weight, direction}` |
| `category` | String? (e.g. "Sleep") |
| `active` | Boolean (default true) |
| `version` | Int (default 1) |
| `order` | Int |

#### `AssessmentSession`
One completed (or in-progress) assessment instance.

| Field | Notes |
|---|---|
| `userId` | FK |
| `startedAt` | DateTime (default now) |
| `completedAt` | DateTime? |
| `version` | Int |

Relations: `answers: AssessmentAnswer[]`, `result: AssessmentResult?` (1-to-1). Index `@@index([userId])`.

#### `AssessmentAnswer`
One answer per question per session.

| Field | Notes |
|---|---|
| `sessionId` | FK |
| `questionId` | FK (kept as raw id; question rows are not deleted if `active=false`) |
| `questionCode` | String — denormalised for resilience |
| `value` | String (the option `value` selected) |
| `score` | Float (default 0; recomputed server-side from `AssessmentQuestion.options`) |
| `createdAt` | DateTime |

Index `@@index([sessionId])`. Cascade on session delete.

#### `AssessmentResult`
The score for a session. Persisted server-side; **never returned to the end user**.

| Field | Notes |
|---|---|
| `sessionId` | `@unique` FK |
| `userId` | String (denormalised for fast lookup) |
| `totalScore` | Float |
| `normalizedScore` | Float (0..100) — internal indicator |
| `wellbeingLevel` | String `NORMAL..CRITICAL` |
| `signalsJson` | JSON array of detected signals |
| `notes` | String? |
| `createdAt` | DateTime |

Index `@@index([userId])`.

### Journals & Voice

#### `DailyJournal`

| Field | Notes |
|---|---|
| `userId` | FK |
| `mood` | String? (`great|good|okay|low|rough`) |
| `content` | String (1..10000 chars) |
| `status` | `DRAFT` \| `SUBMITTED` (default `SUBMITTED`) |
| `analysisJson` | JSON-serialised `JournalAnalysis` (cached from AI provider) |
| `wellbeingLevel` | String? — derived signal level |
| `createdAt`, `updatedAt` | DateTime |

Index `@@index([userId])`.

#### `VoiceEntry`

| Field | Notes |
|---|---|
| `userId` | FK |
| `audioMime` | String |
| `audioSize` | Int (bytes; original upload size) |
| `durationSec` | Int |
| `transcript` | String (raw ASR output) |
| `editedTranscript` | String? (post-review edits) |
| `analysisJson` | String? |
| `wellbeingLevel` | String? |
| `createdAt` | DateTime |

Index `@@index([userId])`. Note: the audio itself is **not persisted** — only the transcript. This is deliberate data minimisation.

### AI conversations

#### `AIConversation`

| Field | Notes |
|---|---|
| `userId` | FK |
| `title` | String? (first 60 chars of first message) |
| `createdAt`, `updatedAt` | DateTime |

Relations: `messages: AIMessage[]`. Index `@@index([userId])`.

#### `AIMessage`

| Field | Notes |
|---|---|
| `conversationId` | FK |
| `role` | `user` \| `assistant` \| `system` |
| `content` | String |
| `riskFlag` | Boolean (default false) — set when the safety classifier fired |
| `metadataJson` | String? — e.g. `{ safety: SAFETY_MESSAGE }` |
| `createdAt` | DateTime |

Index `@@index([conversationId])`.

### Risk engine & alerts

#### `RiskEvent`
An immutable log of every risk-level computation. One row per assessment / journal / voice / AI chat / support trigger + one per periodic `recomputeUserRisk`.

| Field | Notes |
|---|---|
| `userId` | FK |
| `level` | `NORMAL..CRITICAL` |
| `source` | `assessment` \| `journal` \| `voice` \| `ai_chat` \| `manual` \| `rules_engine` |
| `confidence` | Float (0..1) |
| `signalsJson` | JSON array |
| `reason` | String? |
| `acknowledged` | Boolean (default false) |
| `createdAt` | DateTime |

Indexes: `@@index([userId])`, `@@index([level])`.

#### `Alert`
Actionable item for authorized roles. Auto-created by the risk engine when `level ∈ {ELEVATED, HIGH, CRITICAL}` and no open alert for the same user within 24h.

| Field | Notes |
|---|---|
| `userId` | FK (AlertUser relation) |
| `severity` | `LOW` \| `MODERATE` \| `HIGH` \| `CRITICAL` |
| `reason` | String |
| `source` | `risk_engine` \| `ai_safety` \| `manual` \| `support_request` |
| `status` | `OPEN` (default) \| `ACKNOWLEDGED` \| `IN_REVIEW` \| `RESOLVED` |
| `assignedToId` | String? (FK → User, AlertAssignee relation) |
| `resolvedAt` | DateTime? |
| `createdAt`, `updatedAt` | DateTime |

Indexes: `@@index([userId])`, `@@index([status])`, `@@index([severity])`.

### Support, consent, notifications

#### `SupportRequest`

| Field | Notes |
|---|---|
| `userId` | FK (requester) |
| `type` | `general` \| `counselling` \| `urgent` \| `peer` |
| `message` | String (1..2000) |
| `status` | `OPEN` (default) \| `ASSIGNED` \| `RESOLVED` |
| `assignedToId` | String? (FK → User) |
| `createdAt`, `resolvedAt` | DateTime |

Index `@@index([userId])`.

#### `ConsentRecord`
Append-only ledger of consent grants and withdrawals.

| Field | Notes |
|---|---|
| `userId` | FK |
| `purpose` | `assessment` \| `journal_processing` \| `voice_processing` \| `ai_processing` |
| `version` | String (e.g. `"1.0.0"` — `CONSENT_VERSION` from `src/lib/constants.ts`) |
| `status` | `GRANTED` \| `WITHDRAWN` |
| `metadataJson` | String? |
| `createdAt` | DateTime |

Index `@@index([userId])`. The latest record per `(userId, purpose)` is the current state. Withdrawal does not delete the prior grant — both are kept for the audit trail.

#### `Notification`
Generic in-app notification. Scaffolded but not yet written by any route (next step).

| Field | Notes |
|---|---|
| `userId` | FK |
| `type` | String |
| `title` | String |
| `body` | String? |
| `read` | Boolean (default false) |
| `createdAt` | DateTime |

Index `@@index([userId])`.

### Audit log

#### `AuditLog`
The forensic record. See `docs/SECURITY.md` §Audit logging.

| Field | Notes |
|---|---|
| `actorId` | String? (FK → User, `onDelete: SetNull` so audit rows survive user deletion) |
| `action` | String (one of `AUDIT_ACTIONS`) |
| `targetType` | String? |
| `targetId` | String? |
| `ipHash` | String? (24-char HMAC-SHA256 prefix) |
| `metadataJson` | String? (curated JSON, no raw content) |
| `createdAt` | DateTime |

Indexes: `@@index([actorId])`, `@@index([action])`.

### Configurable content

#### `Resource`
Wellbeing resource articles (DB-driven, not hardcoded in components).

| Field | Notes |
|---|---|
| `title`, `summary`, `body` | String |
| `category` | String (one of `RESOURCE_CATEGORIES`) |
| `source` | String? |
| `durationMin` | Int? |
| `tags` | String? (JSON array) |
| `order` | Int |
| `active` | Boolean |
| `createdAt` | DateTime |

#### `EmergencyContact`
Phone / chat / crisis contacts shown on the Support view.

| Field | Notes |
|---|---|
| `label`, `description`, `contact` | String |
| `availableHours` | String? (e.g. `"24/7"`, `"Mon–Fri 0900–1700"`) |
| `order` | Int |
| `active` | Boolean |
| `createdAt` | DateTime |

---

## 3. Index summary

Indexes exist on every foreign key (for fast `where: { userId }` queries that power every dashboard / list view) and on the columns most-filtered in the admin console:

- `Session.userId`
- `AssessmentSession.userId`, `AssessmentAnswer.sessionId`, `AssessmentResult.userId`
- `DailyJournal.userId`, `VoiceEntry.userId`
- `AIConversation.userId`, `AIMessage.conversationId`
- `RiskEvent.userId`, `RiskEvent.level`
- `Alert.userId`, `Alert.status`, `Alert.severity`
- `SupportRequest.userId`, `ConsentRecord.userId`, `Notification.userId`
- `AuditLog.actorId`, `AuditLog.action`

Uniques: `User.email`, `Session.tokenHash`, `AssessmentQuestion.code`, `AssessmentResult.sessionId`.

---

## 4. Seed data

`src/lib/seed.ts` is invoked via `POST /api/seed` (dev-only; returns 403 in production unless `ALLOW_SEED=1`). It is **idempotent**: if users already exist, it skips unless `?force=1` is passed.

### 8 fictional users (password: `Sentinel@2025`)

| Email | Role | Notes |
|---|---|---|
| `admin@sentinel.dev` | ADMIN | Sees analytics + audit + alerts; **no** clinical perms |
| `pro@sentinel.dev` | MENTAL_HEALTH_PROFESSIONAL | Has `VIEW_JOURNAL` / `VIEW_AI_CONVERSATION` / `VIEW_ASSESSMENT` |
| `supervisor@sentinel.dev` | SUPERVISOR | Limited operational view |
| `user@sentinel.dev` | USER | Onboarding complete |
| `daniel@sentinel.dev` | USER | Sample personnel w/ seeded journal |
| `sara@sentinel.dev` | USER | `firstLogin=true` → triggers assessment onboarding |
| `tom@sentinel.dev` | USER | Sample personnel w/ alert |
| `aisha@sentinel.dev` | USER | Sample personnel |

All names, service numbers, units, and ranks are invented — never use real personal data.

### 7 assessment questions

`Q1_SLEEP`, `Q2_MOOD`, `Q3_STRESS`, `Q4_CONNECT`, `Q5_FOCUS`, `Q6_ENERGY`, and a seventh wellbeing question. Each has 5 options scored 0..4 across categories `Sleep`, `Mood`, `Stress`, `Social`, `Cognition`, `Energy`, plus one more. See `src/lib/seed.ts::ASSESSMENT_QUESTIONS`.

### 8 resources
Spread across `Stress`, `Burnout`, `Sleep`, `Relationships`, `Family Separation`, `Operational Stress`, `Relaxation`, `Breathing Exercises`, `Mental Wellbeing`, `Professional Support` — see `src/lib/constants.ts::RESOURCE_CATEGORIES`.

### 4 emergency contacts
Including a 24/7 crisis line, a counselling intake, a peer-support line, and a chaplaincy contact — all DB-driven placeholders, ready to be replaced with real numbers in production.

### Sample journals, assessments, alerts

- One assessment session + result per onboarded USER (4 users), with varying `wellbeingLevel` values to exercise the risk distribution charts.
- 4 sample journal entries (moods `low`, `okay`, `rough`, `good`) with cached `analysisJson` showing the structure.
- A handful of alerts assigned to the MENTAL_HEALTH_PROFESSIONAL for demo flows.
- One sample `SupportRequest` to exercise the admin UI.

All seeded data carries clearly fictional content. The `runSeed(force)` function uses `deleteMany({})` on every table when `force=true` before re-inserting — see `src/lib/seed.ts`.

---

## 5. Migration strategy

### Dev (current)

```bash
bun run db:generate   # regenerate the Prisma client after schema changes
bun run db:push       # apply schema to SQLite (uses --accept-data-loss in package.json)
bun run db:reset      # wipe + recreate + re-seed (dev only)
```

`db:push` is non-destructive by default — it adds new columns/tables without dropping existing data, but Prisma may prompt or refuse if a column is removed. The `--accept-data-loss` flag in `package.json` lets dev iterations move fast.

### Production (PostgreSQL)

1. Set `DATABASE_URL=postgresql://user:pass@host:5432/sentinel` in `.env`.
2. Use the Prisma migration workflow instead of `db:push`:
   ```bash
   bunx prisma migrate dev --name init    # create the initial migration (locally)
   bunx prisma migrate deploy              # apply on the prod DB (CI/CD)
   ```
3. Seed via the `/api/seed` endpoint only if `ALLOW_SEED=1` is set — otherwise it returns 403.
4. For column type changes (e.g. promoting `String` enums to native Postgres `enum`), generate a migration that:
   - adds the new enum type,
   - adds a new column of that type,
   - backfills from the old String column,
   - drops the old column.

### Prisma client singleton

`src/lib/db.ts` exports a single `PrismaClient` instance, cached on `globalThis` in dev to avoid exhausting connections during Next.js hot reloads. Query logging is **intentionally disabled** (`log: ['error', 'warn']`) — full query logging spams `dev.log` and consumes memory on constrained hosts. Re-enable locally with `log: ['query', 'error', 'warn']` if you need to debug.

---

## 6. Backup guidance

### SQLite (dev)

The DB is a single file at `db/custom.db`. To back up:

```bash
cp db/custom.db "db/custom-$(date +%Y%m%d).db"
```

Or use the SQLite online backup API via `sqlite3 db/custom.db ".backup /tmp/backup.db"`.

### PostgreSQL (prod)

- **Managed snapshots** — enable daily automated snapshots on your RDS / Cloud SQL instance; retain 7-30 days.
- **Point-in-time recovery** — turn on PITR so you can restore to any second within the retention window.
- **Logical exports** — nightly `pg_dump --format=custom` to object storage (S3 / GCS), encrypted at rest. Test restore quarterly.
- **Audit log** — the `AuditLog` table is the most retention-sensitive. Decide on a 1-year / 7-year / indefinite policy based on your local legal framework and document it.
- **Voice audio** — not persisted; only transcripts are. No audio backups needed.
- **Encryption at rest** — Postgres-level TDE or volume-level encryption (LUKS, EBS encryption). Application-level field encryption for journals/conversations is a documented next step.

### Restore test

A backup that has never been restored is not a backup. Run a quarterly restore drill into a staging DB and verify the app boots + RBAC still works + the audit log is intact.
