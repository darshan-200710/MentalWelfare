# Security

> The standalone FastAPI service in `backend/` uses Argon2 password hashing, bearer access tokens with rotated refresh sessions, server-side permission dependencies, request security headers, and an Alembic-managed SQLAlchemy schema. Its API-specific controls are documented in [API.md](API.md) and [DEPLOYMENT.md](DEPLOYMENT.md).

> This document is the security model for Sentinel. It covers the threat model, password hashing, session management, RBAC enforcement, audit logging, sensitive-access gating, the AI safety layer, file-upload validation, input validation, rate limiting, and a production hardening checklist.

Every claim below is cross-referenced to the exact file/function in the codebase. The system is **honest about its limitations** — the "next steps" sections call out what is not yet implemented.

---

## 1. Threat model (OWASP Top 10)

| # | Risk | Mitigation in Sentinel | Where |
|---|---|---|---|
| A01 | Broken Access Control | `requirePermission(perm)` on every sensitive endpoint. The frontend `hasPermission` checks in `src/app/page.tsx` are cosmetic — the backend re-enforces. Every `[id]` route (journals, admin/alerts, admin/personnel) explicitly resolves ownership or RBAC before returning data. Unauthorized attempts are audit-logged as `unauthorized_access_attempt`. | `src/lib/auth.ts::requirePermission`, every `src/app/api/admin/**/route.ts`, `src/app/api/journals/[id]/route.ts` |
| A02 | Cryptographic Failures | Passwords hashed with scrypt (N=16384, r=8, p=1, 64-byte key). Session tokens are 32 random bytes, stored only as SHA-256 hashes. IPs in audit logs are HMAC-hashed with `AUDIT_IP_SALT`. `secure` cookie flag in production. No plaintext credentials, API keys, or session tokens are ever logged. | `src/lib/auth.ts`, `src/lib/audit.ts` |
| A03 | Injection (SQLi) | All DB access goes through Prisma, which parameterises every query. No raw SQL strings anywhere in the codebase. JSON columns (`analysisJson`, `signalsJson`, `metadataJson`, `options`, `scoringMeta`, `tags`) are parsed only on read with try/catch guards. | `prisma/schema.prisma`, every `route.ts` |
| A03 | Injection (XSS) | React escapes all rendered text by default. Rich text is not user-generated. No `dangerouslySetInnerHTML` is used in the app views. CSP-ready (a Content-Security-Policy header can be added at the Caddy/nginx layer — see Deployment). | `src/components/views/**` |
| A04 | Insecure Design | Provider abstraction (`AIProvider`) means no vendor lock-in; least-privilege RBAC where ADMIN cannot read clinical content; deterministic safety layer that the LLM cannot override; consent records per purpose. | `src/lib/ai/provider.ts`, `src/lib/constants.ts::PERMISSIONS` |
| A05 | Security Misconfiguration | `ALLOW_SEED=0` by default — `/api/seed` returns 403 in production unless explicitly enabled. `NODE_ENV=development` only in dev. Query logging is OFF to avoid leaking data into `dev.log`. Cookie `secure` flag is conditional on `NODE_ENV=production`. | `src/lib/db.ts`, `src/app/api/seed/route.ts`, `src/lib/auth.ts::createSession` |
| A06 | Vulnerable Components | `bun` lockfile pinned. `next` 16.1.x, `prisma` 6.11.x, `react` 19. Run `bun audit` periodically (not automated). | `package.json`, `bun.lock` |
| A07 | Auth Failures | Account lockout (5 failed attempts → 15-min lock). Generic "Invalid email or password" error that does not leak which field was wrong. Login throttled by `failedLoginAttempts` counter on the `User` row. Session cookies are httpOnly + SameSite=Lax + (in prod) Secure. | `src/lib/auth.ts::recordFailedLogin`, `src/app/api/auth/login/route.ts` |
| A08 | Data Integrity Failures | Zod validation on every request body. Assessment scoring is recomputed server-side — the client's `score` field is never trusted (the route looks up the option's score from the DB). Consent records are versioned (`CONSENT_VERSION` in `src/lib/constants.ts`). | `src/app/api/assessments/route.ts`, every route's Zod schema |
| A09 | Logging & Monitoring Failures | Every sensitive action writes an `AuditLog` row (actor, action, target type+id, hashed IP, metadata). The audit logger never throws into the request flow (`try/catch` + `console.error`). Unauthorized attempts are logged. | `src/lib/audit.ts`, every `route.ts` |
| A10 | SSRF | No outbound user-controlled HTTP requests except to the trusted `z-ai-web-dev-sdk` endpoint (server-side only). TTS/ASR inputs are bounded (1024 chars / 10 MB). | `src/app/api/tts/route.ts`, `src/app/api/voice/transcribe/route.ts` |

### Prompt injection (AI-specific threat)

| Vector | Mitigation | Where |
|---|---|---|
| User tries to override the system prompt | The system prompt is **owned by the backend** (`src/lib/ai/provider.ts::SYSTEM_PROMPT`). The client never sends a system message; the user's messages are placed in the `user` role only. | `src/app/api/ai/chat/route.ts` |
| User embeds "ignore previous instructions" in journal/chat text | The text is treated as untrusted input — it is only ever embedded as a `user` message. The deterministic safety classifier runs **before** the LLM and can short-circuit escalation regardless of what the LLM would have said. | `src/lib/ai/provider.ts::detectRiskSignals` |
| LLM output contains dangerous content | The safety classifier re-runs on the LLM's output (defense in depth). If high-risk patterns are found, `riskFlag=true` is set and the route triggers a risk event + alert. | `src/lib/ai/provider.ts::ZAIAIProvider.chat` |
| User tries to make the LLM execute tools / actions | There are **no tools / function-calling hooks** registered with the LLM. The model can only return text. | `src/app/api/ai/chat/route.ts` |
| System prompt leakage | The system prompt is never echoed in any API response. The LLM is instructed to refuse to reveal it. | `src/lib/ai/provider.ts::SYSTEM_PROMPT` rule |
| AI data leakage to other users | Conversation history is scoped `where: { userId: user.id }` on every read. Cross-user access requires `VIEW_AI_CONVERSATION` and is audit-logged. | `src/app/api/ai/conversations/route.ts`, `src/app/api/admin/personnel/[id]/route.ts` |

---

## 2. Password hashing

```ts
// src/lib/auth.ts
const SCRYPT_N = 16384;   // CPU/memory cost
const SCRYPT_R = 8;       // block size
const SCRYPT_P = 1;       // parallelism
const KEY_LEN = 64;       // output bytes

hashPassword(plain): "scrypt$<saltHex>$<hashHex>$16384$8$1"
verifyPassword(plain, stored): timingSafeEqual(...)
```

- **Algorithm:** Node built-in `scryptSync` (no external native deps). Argon2-equivalent strength at these parameters.
- **Salt:** 16 random bytes per password (`randomBytes(16)`), stored alongside the hash. Unique per user.
- **Format:** `scrypt$<saltHex>$<hashHex>$<N>$<r>$<p>` — self-describing so parameters can be upgraded without invalidating existing hashes (a migration can re-hash on next login with stronger params).
- **Verification:** `timingSafeEqual(a, b)` to prevent timing attacks. Any malformed stored hash returns `false` rather than throwing.
- **`maxmem`:** 128 MiB to allow N=16384.
- **Storage:** `User.passwordHash` (nullable — null for OAuth-only accounts once OAuth is wired).

Passwords are **never** logged. The login audit entry records only `action: failed_login` / `login` and the user id — never the password, never even a hash of it.

---

## 3. Session management

| Property | Value | Where |
|---|---|---|
| Cookie name | `sw_session` | `src/lib/auth.ts::SESSION_COOKIE` |
| Token | 32 random bytes, hex-encoded (64 chars) | `randomBytes(32).toString("hex")` |
| Token storage | SHA-256 hash, in `Session.tokenHash` (unique) | `db.session.create` |
| TTL | 7 days | `SESSION_TTL_DAYS = 7` |
| Cookie flags | `httpOnly: true`, `sameSite: "lax"`, `secure: NODE_ENV === "production"`, `path: "/"` | `createSession` |
| Expiry | `Session.expiresAt` checked on every read; expired sessions return `null` from `getCurrentUser` | `getCurrentUser` |
| Revocation | `destroySession(token)` sets `Session.revokedAt = now()` and deletes the cookie | `destroySession` |
| Rotation | Not automatic (next step). Re-issuing a session on privilege change is straightforward to add. | — |
| User-agent / IP | Stored on `Session.userAgent` (truncated to 255) and `Session.ipHash` (32-char SHA-256 prefix of the raw IP). | `createSession` |

The current user is resolved by `getCurrentUser()`:

1. Read `sw_session` cookie.
2. SHA-256 the token, `db.session.findUnique({ where: { tokenHash }, include: { user: true } })`.
3. Reject if `revokedAt` set or `expiresAt < now`.
4. Light-touch activity tracking: if `user.lastActiveAt` is stale by > 60s, refresh it.
5. Return `{ user: SafeUser, dbUser: User }` or `null`.

A 401 from any endpoint triggers the client fetcher to clear `user` in the store (`src/lib/api.ts::request`).

---

## 4. RBAC enforcement

```ts
// src/lib/auth.ts
export async function requirePermission(perm: Permission) {
  const { user, dbUser } = await requireAuth();
  if (!hasPerm(user.role, perm)) {
    await logAudit({ actorId: user.id, action: "unauthorized_access_attempt",
                     targetType: "Permission", targetId: perm });
    throw new ApiRequestError("You do not have permission to perform this action.", 403, "FORBIDDEN");
  }
  return { user, dbUser };
}
```

The full permission matrix lives in `src/lib/constants.ts::PERMISSIONS` and is reproduced in `README.md` §RBAC. The sensitive-access rule worth repeating:

> **`ADMIN` cannot read journals, AI conversations, or assessments.** Only `MENTAL_HEALTH_PROFESSIONAL` and `SUPER_ADMIN` hold `VIEW_JOURNAL`, `VIEW_AI_CONVERSATION`, and `VIEW_ASSESSMENT`. ADMIN is for platform administration (users, system, audit, analytics) — not clinical care.

### The `apiRoute` wrapper

`src/lib/api-shared.ts::apiRoute(fn)` wraps every exported handler. It:

1. Calls `fn(...)` inside `try`.
2. If `fn` throws an `ApiRequestError`, returns `Response.json({ error: e.message, code: e.code }, { status: e.status })`.
3. Otherwise logs `[api] unhandled error: <e>` and returns a 500 JSON with the message.

Without this wrapper, every thrown `ApiRequestError(401/403/404/422/409/413/415/423)` would become an opaque Next.js 500 HTML page — breaking RBAC enforcement at the API boundary. Every one of the 30 handlers across 26 route files is wrapped this way (Task 3-fix in `worklog.md`).

### Ownership checks

The `[id]` routes do explicit ownership + RBAC checks before returning or mutating data:

```ts
// src/app/api/journals/[id]/route.ts::resolveJournal
if (j.userId !== actorId) {
  if (!hasPermission(actorRole, "VIEW_JOURNAL")) {
    return { error: jsonError("You do not have permission to access this journal.", 403) };
  }
}
```

`PUT` and `DELETE` on journals are **owner-only** — even a `MENTAL_HEALTH_PROFESSIONAL` cannot edit a journal they can read; they can only view it.

---

## 5. Audit logging

`src/lib/audit.ts::logAudit` is the only entry point. Every call writes a row to `AuditLog`:

| Column | Content |
|---|---|
| `actorId` | The acting user's id, or `null` for unauthenticated actions (e.g. failed login). |
| `action` | One of the `AUDIT_ACTIONS` constants (e.g. `login`, `journal_access`, `sensitive_access`, `ai_safety_triggered`). See `src/lib/constants.ts`. |
| `targetType` | `"User"`, `"Journal"`, `"AIConversation"`, `"Alert"`, `"Permission"`, etc. |
| `targetId` | The id of the affected entity. |
| `ipHash` | HMAC-SHA256 of the actor's IP (first 24 hex chars), salted with `AUDIT_IP_SALT`. **Raw IPs are never stored.** |
| `metadataJson` | A curated JSON object — never raw content, never secrets. E.g. `{ level: "HIGH", source: "journal" }`. |
| `createdAt` | `now()`. |

### What is logged

- Auth: `login`, `logout`, `failed_login`, `password_reset_request` (placeholder).
- Sensitive reads: `assessment_access`, `journal_access`, `conversation_access`, `sensitive_access` (the umbrella action used when a role with `VIEW_JOURNAL` / `VIEW_AI_CONVERSATION` reads someone else's content), `user_profile_access`.
- User content actions: `journal_submitted`, `journal_draft_saved`, `journal_updated`, `journal_deleted`, `assessment_submitted`, `voice_transcribe`, `ai_chat`, `ai_safety_triggered`.
- Risk & alerts: `risk_event_created`, `alert_created`, `alert_updated`.
- Consent: `consent_granted`, `consent_withdrawn`.
- Admin: `admin_view_personnel`, `unauthorized_access_attempt`, `system_seed`.

### What is NOT logged

- Passwords (never).
- Session tokens (never — only the hashed IP).
- API keys / `AUDIT_IP_SALT` (never).
- Raw journal/conversation content beyond what the action inherently describes (the `targetId` references it; the content itself is in the `DailyJournal.content` row, not in the audit log).
- Full IP addresses (only the 24-char HMAC prefix; rotating `AUDIT_IP_SALT` invalidates all prior hashes — see Production checklist).

### Resilience

`logAudit` wraps the Prisma write in `try/catch`. If the DB is unreachable, it logs to `console.error` and **does not** break the request flow. The cost of a missed audit entry is preferred over a 500 on a user trying to log in.

---

## 6. Sensitive-access gating

`/api/admin/personnel/[id]` is the canonical example. The route:

1. Requires `VIEW_USER_PROFILE` (so all admin-ish roles pass).
2. Loads the person's operational profile (name, unit, rank, status, last activity — non-clinical).
3. **Conditionally** loads clinical sections based on the actor's permissions:

```ts
let assessments = [];
if (hasPermission(user.role, "VIEW_ASSESSMENT")) {
  // ... load + audit log SENSITIVE_ACCESS
}
let journals = [];
if (hasPermission(user.role, "VIEW_JOURNAL")) { ... }
let conversations = [];
if (hasPermission(user.role, "VIEW_AI_CONVERSATION")) { ... }
```

4. Every sensitive read writes a `SENSITIVE_ACCESS` audit entry with `metadata: { reason: "VIEW_JOURNAL", ownerId: <target> }` (or `VIEW_AI_CONVERSATION` / `VIEW_ASSESSMENT`).
5. The response includes an explicit `visible` object so the UI knows what it was authorised to see:

```json
"visible": { "risk": true, "assessments": false, "journals": false, "conversations": false }
```

The admin UI shows a `RestrictedNotice` component for the sections that came back empty — not a fake "no data" message — so it's clear the access was denied, not that the person has no journals.

---

## 7. AI safety layer

```ts
// src/lib/ai/provider.ts
export function detectRiskSignals(text): {
  signals: string[];
  requires_human_review: boolean;
  highRisk: boolean;
}
```

- **`HIGH_RISK_PATTERNS`** (12 patterns) match language like `kill myself`, `suicidal`, `don't want to live`, `end it all`, `no reason to live`, `hurt myself`, `take my own life`, `better off dead`, `give up on life`, `self-harm`, `can't go on`, `goodbye forever`.
- **`ELEVATED_PATTERNS`** (16 patterns) match `hopeless`, `helpless`, `overwhelm`, `burnt out`, `exhausted`, `can't cope`, `breaking down`, `isolat`, `alone`, `panic`, `anxiety`, `nightmare`, `cannot sleep`, `insomnia`, `numb`.
- `requires_human_review = highRisk || signals.length >= 3`.
- This function is **deterministic** and **runs before the LLM is called** in `ZAIAIProvider.chat` and `analyzeJournal`. If `highRisk`, the LLM is bypassed entirely and the `SAFETY_MESSAGE` is returned.

### Defense in depth

The LLM's own output is re-scanned by `detectRiskSignals(content)`. If high-risk patterns appear in the model's response, `riskFlag=true` is set even though the user's message was benign. The route then triggers a risk event + alert.

### Escalation path

When `riskFlag === true`:

1. `triggerRiskFromContent({ source: "ai_chat", level: "HIGH", confidence: 0.9, signals: ["high_risk_language"], reason: "AI safety layer detected potential high-risk language in chat" })`.
2. This writes a `RiskEvent` and (because level ∈ {HIGH}) auto-creates an `Alert` (severity `HIGH`) — de-duplicated within 24h.
3. `ai_safety_triggered` audit entry is written.
4. The user sees the `SAFETY_MESSAGE` in their chat UI, plus an amber support panel with a "Get support now" CTA.

The LLM never decides whether to escalate. The deterministic classifier does.

---

## 8. File upload validation

`src/app/api/voice/transcribe/route.ts`:

| Check | Value | Error on failure |
|---|---|---|
| MIME allowlist | `audio/wav, audio/x-wav, audio/mpeg, audio/mp3, audio/webm, audio/ogg, audio/m4a, audio/x-m4a` | `415 BAD_MIME` |
| Max size | 10 MiB (`10 * 1024 * 1024`) | `413 TOO_LARGE` |
| Base64 decoding | `Buffer.from(b64, "base64")` — fails on invalid input | `400` (empty payload) |
| Duration cap | `0..3600` seconds (Zod) | `422` |
| Body schema | `z.object({ audio: z.string().min(1), mime: z.string().min(1), durationSec: z.number().min(0).max(3600).default(0) })` | `422` |
| `data:` URL stripping | `if (b64.startsWith("data:") && comma > -1) b64 = b64.slice(comma + 1)` | — |

No file is written to disk — the audio buffer is sent straight to `zai.audio.asr.create({ file_base64 })` and discarded. Only the transcript is persisted.

---

## 9. Input validation

- **Zod** on every request body. Each route defines its schema inline and returns the first Zod issue message as the `422` body.
- **MIME** allowlist on voice uploads.
- **Length caps** to bound LLM input: journal content 1..10000 chars, AI chat message 1..4000, TTS text 1..1024, voice audio 0..10 MiB, support message 1..2000.
- **Enum validation** for `mood`, `status`, `severity`, `support type`, `consent purpose` — anything not in the enum returns `422`.
- **No client scores are trusted.** The assessment route looks up each option's `score` from the DB (`AssessmentQuestion.options` JSON) and recomputes the total server-side (`src/app/api/assessments/route.ts`).
- **`force-dynamic`** on every route (`export const dynamic = "force-dynamic"`) — no static optimisation accidentally caches a user-specific response.

---

## 10. Rate limiting / account lockout

- **Brute-force defense on `/api/auth/login`** — `recordFailedLogin(email)` increments `User.failedLoginAttempts`; at 5 attempts, `lockedUntil = now + 15min`. `isLocked(user)` short-circuits the login check and returns `423 LOCKED`. Successful login calls `clearFailedLogin(userId)`.
- **Generic error messages** — login returns `401 INVALID_CREDENTIALS` whether the email doesn't exist or the password is wrong. No user enumeration.
- **Audit on failed login** — both "no such user" and "wrong password" paths write a `failed_login` audit entry (the latter with the user id; the former with `actorId: null` and `targetId: email`).
- **No IP-based rate limiting** in the current build. For production, a Caddy/nginx rate-limit layer or a Redis token-bucket in front of `/api/auth/login` is the recommended next step.

---

## 11. Production hardening checklist

Before handling real personnel data, work through this list:

- [ ] **HTTPS termination** — Caddy or nginx in front of Next.js; redirect all HTTP → HTTPS; HSTS header. The `secure` cookie flag only takes effect in production mode.
- [ ] **Rotate `AUDIT_IP_SALT`** — the dev default `sentinel-dev-salt-change-me` is in `.env.example`. Generate a fresh 32-byte random value for prod. (Note: this invalidates all dev-time `ipHash` values, which is fine — they were dev data.)
- [ ] **PostgreSQL** — change `DATABASE_URL` to a managed Postgres. Run `prisma migrate deploy` (see `docs/DATABASE.md` §Migration strategy).
- [ ] **OAuth (Google OIDC)** — fill `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` and implement `/api/auth/google` using `next-auth` v4 (already in `package.json`).
- [ ] **SMTP** — fill `SMTP_*` and wire a real email sender for forgot-password / verify-email.
- [ ] **MFA (TOTP)** — the UI scaffold exists (`ProfileView` MFA toggle); wire a TOTP enrolment + verification flow backed by `User.mfaSecret`.
- [ ] **Backups** — daily Postgres snapshots + point-in-time recovery; test restore quarterly.
- [ ] **Secrets management** — move all env vars to a secrets manager (AWS Secrets Manager, Doppler, Vault). Never commit `.env`.
- [ ] **CSP / security headers** — add `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` at the gateway.
- [ ] **Rate limiting at the edge** — Caddy/nginx rate-limit on `/api/auth/login` and `/api/voice/transcribe`.
- [ ] **Real emergency contacts** — replace the seeded placeholders in `EmergencyContact` with the actual support line / crisis text / counselling intake.
- [ ] **Third-party security review** — pen-test + code review before going live with real data.
- [ ] **Consent migration** — bump `CONSENT_VERSION` in `src/lib/constants.ts` whenever the privacy policy changes; require re-consent on next login.
- [ ] **Audit log retention policy** — set a deletion or archival schedule that matches the local legal framework (GDPR / military data regulations).
- [ ] **Field-level encryption** (next step) — journals and AI conversations contain the most sensitive free-text. Consider application-level encryption with a key not stored alongside the DB.
