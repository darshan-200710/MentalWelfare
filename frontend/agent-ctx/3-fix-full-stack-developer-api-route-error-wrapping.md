# Task 3-fix — Wrap all API route handlers with `apiRoute`

**Agent:** full-stack-developer (api route error wrapping)
**Scope:** mechanical transform of every exported handler (`GET`/`POST`/`PUT`/`DELETE`) in `src/app/api/**/route.ts` so `ApiRequestError` (401/403/404/422) reaches clients as a proper JSON Response instead of being swallowed by Next.js into a 500.

## Transform applied to each file

For every exported handler:
1. `export async function METHOD(...)` → `async function _METHOD(...)` (drop `export`, prefix `_`, body UNCHANGED).
2. At end-of-file, append `export const METHOD = apiRoute(_METHOD);`.
3. Add `apiRoute` to the `@/lib/api-shared` import list (new import line if the file didn't already import from there).
4. `export const dynamic = "force-dynamic";` lines and all other code untouched.

Dynamic-route `[id]` files preserve their second `params` arg verbatim, e.g. `async function _GET(req: NextRequest, { params }: { params: Promise<{ id: string }> })`.

## Files converted (27 handlers across 26 files)

| Route file | Handlers wrapped |
|---|---|
| `src/app/api/auth/login/route.ts` | POST |
| `src/app/api/auth/logout/route.ts` | POST (inline `await import("next/headers")` preserved) |
| `src/app/api/auth/me/route.ts` | GET |
| `src/app/api/journals/route.ts` | GET, POST |
| `src/app/api/journals/[id]/route.ts` | GET, PUT, DELETE |
| `src/app/api/assessments/route.ts` | GET, POST |
| `src/app/api/assessments/history/route.ts` | GET |
| `src/app/api/voice/transcribe/route.ts` | POST |
| `src/app/api/ai/chat/route.ts` | POST |
| `src/app/api/ai/analyze-journal/route.ts` | POST |
| `src/app/api/ai/conversations/route.ts` | GET |
| `src/app/api/support/route.ts` | GET, POST |
| `src/app/api/resources/route.ts` | GET |
| `src/app/api/emergency-contacts/route.ts` | GET |
| `src/app/api/consent/route.ts` | GET, POST |
| `src/app/api/dashboard/route.ts` | GET |
| `src/app/api/tts/route.ts` | POST |
| `src/app/api/seed/route.ts` | POST |
| `src/app/api/admin/dashboard/route.ts` | GET |
| `src/app/api/admin/personnel/route.ts` | GET |
| `src/app/api/admin/personnel/[id]/route.ts` | GET |
| `src/app/api/admin/risk/route.ts` | GET |
| `src/app/api/admin/alerts/route.ts` | GET |
| `src/app/api/admin/alerts/[id]/route.ts` | GET, PUT |
| `src/app/api/admin/audit-logs/route.ts` | GET |
| `src/app/api/admin/analytics/route.ts` | GET |

**Total: 26 files, 30 handlers wrapped.**

## Notes / out-of-scope findings

- **`src/app/api/auth/register/route.ts` is listed in the task spec but does not exist in the repo.** The `src/app/api/auth/register/` directory exists but is empty. The Task 5-B worklog already notes that "the register backend route (`POST /api/auth/register`) referenced by RegisterView is not yet present in the repo — a backend agent should implement it". Since this task is purely a mechanical wrap of EXISTING route handlers and the task rules forbid "touching any other files" / changing logic, I did not create a new register route file. When a future agent implements `auth/register/route.ts`, they should wrap its handlers with `apiRoute` from the start.
- **Pre-existing Prisma bug in `/api/admin/analytics` and `/api/assessments/history`** (NOT introduced by this task — bodies were left unchanged per the rules): both routes query `db.assessmentSession.findMany({ ... createdAt ... })`, but the `AssessmentSession` Prisma model only has `startedAt` (no `createdAt`). This throws `PrismaClientValidationError` at runtime. The new `apiRoute` wrapper correctly catches this non-`ApiRequestError` exception and returns a JSON 500 with the error message — exactly the contract documented in `src/lib/api-shared.ts`. The bug itself (wrong field name) is outside Task 3-fix's scope ("Do NOT change any logic inside the function bodies").

## Lint

`bun run lint` runs clean with zero errors after conversion (purely mechanical transform — no logic changed, only function renames + an import addition + a trailing `export const` line per handler).

## Verification (RBAC fix confirmed)

Started the dev server in the background, then ran the prescribed curls:

```
================ USER (expected all 403) ================
login(user): 200
  dashboard:   403
  personnel:   403
  risk:        403
  alerts:      403
  audit-logs:  403
  analytics:   403

================ ADMIN (expected all 200) ================
login(admin): 200
  dashboard:   200
  personnel:   200
  risk:        200
  alerts:      200
  audit-logs:  200
  analytics:   500   ← pre-existing Prisma `createdAt` field bug, OUT OF SCOPE

================ USER /api/admin/dashboard body ===============
{"error":"You do not have permission to perform this action.","code":"FORBIDDEN"}

================ Sanity: non-admin routes still work for USER ================
  /api/dashboard:            200
  /api/journals:             200
  /api/assessments/history:  500   ← same pre-existing Prisma `createdAt` field bug
  /api/ai/conversations:     200
  /api/consent:              200
  /api/support:              200
  /api/resources:            200
  /api/emergency-contacts:   200
```

### Interpretation
- **The RBAC fix is verified.** A USER logging in then hitting any `/api/admin/*` endpoint now receives `403 {"error":"You do not have permission to perform this action.","code":"FORBIDDEN"}` — exactly the `ApiRequestError` thrown by `requirePermission` in `src/lib/auth.ts`, surfaced through `apiRoute`'s catch. Previously these all returned 500.
- **Admin still works** on 5/6 endpoints (dashboard, personnel, risk, alerts, audit-logs all return 200).
- The two 500s (`/api/admin/analytics` for ADMIN, `/api/assessments/history` for USER) are **pre-existing Prisma field-name bugs** in route bodies that were left untouched per the task's "Do NOT change any logic" rule. The `apiRoute` wrapper behaves exactly as designed — it catches the non-`ApiRequestError` `PrismaClientValidationError`, logs `[api] unhandled error:`, and returns a JSON 500 with the Prisma error message (instead of letting Next.js render an opaque HTML 500 page).

## Stage Summary
- 26 route files / 30 handlers mechanically wrapped with `apiRoute`.
- `bun run lint` clean.
- RBAC fix verified end-to-end: USER → 403 on all admin endpoints (was 500); ADMIN → 200 on 5/6 admin endpoints (the 6th has a pre-existing Prisma bug unrelated to this task).
- Two pre-existing Prisma `createdAt`-vs-`startedAt` field bugs noted for a future backend-fix task.
- `src/app/api/auth/register/route.ts` confirmed absent from repo — left for the backend agent who will implement register.
