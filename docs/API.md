# Sentinel API

The FastAPI service publishes interactive OpenAPI documentation at `/docs` and a machine-readable schema at `/openapi.json`. All protected endpoints require an `Authorization: Bearer <access token>` header. Access tokens are short lived; send the refresh token only to `POST /api/auth/refresh` to rotate it.

## Authentication

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/auth/register` | Create a minimal personnel account and return a token pair. |
| POST | `/api/auth/login` | Authenticate after password and lockout checks. |
| POST | `/api/auth/refresh` | Rotate a valid refresh token. |
| POST | `/api/auth/logout` | Revoke a refresh session. |
| GET | `/api/auth/me` | Return the authenticated account’s non-sensitive profile. |

Password-reset and Google OIDC endpoints deliberately return `501` until their external services are configured. They must not be presented as working production features before then.

## Wellbeing APIs

| Method | Endpoint | Notes |
| --- | --- | --- |
| GET/POST | `/api/assessments/current`, `/api/assessments` | Questions and server-scored submission. The submission never returns the internal indicator. |
| GET | `/api/assessments/history` | Own assessment sessions only. |
| GET/POST | `/api/journals` | Own journal list and create/draft endpoint. |
| GET/PUT/DELETE | `/api/journals/{id}` | Ownership is enforced in the query. |
| POST | `/api/voice/transcribe` | Multipart `audio`, MIME/size validated; transcript remains review-only. |
| POST | `/api/ai/chat` | AI provider is server-side; deterministic safety escalation is applied first. |
| GET | `/api/ai/conversations` | Own conversation headings. |
| POST/GET | `/api/support/request`, `/api/support/requests` | Human-support workflow. |
| GET | `/api/resources`, `/api/emergency-contacts` | Configurable support information. |
| GET/PUT | `/api/users/me` | Data-minimised profile access. |
| POST | `/api/consent` | Versioned processing consent record. |

## Admin APIs and permissions

Admin endpoints enforce permissions on the backend, independent of the UI.

| Endpoint | Required permission |
| --- | --- |
| `/api/admin/dashboard`, `/api/admin/personnel`, `/api/admin/personnel/{id}` | `VIEW_USER_PROFILE` |
| `/api/admin/risk` | `VIEW_RISK_INDICATOR` |
| `/api/admin/alerts` | `MANAGE_ALERTS` |
| `/api/admin/analytics` | `VIEW_ANALYTICS` |
| `/api/admin/audit-logs` | `VIEW_AUDIT_LOGS` |

`include_sensitive=true` on a personnel detail request requires explicit `VIEW_JOURNAL` permission. An `ADMIN` role does not possess that clinical-content permission by default; this is verified by a test.
