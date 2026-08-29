# Privacy and data handling

Sentinel identifies authenticated users; it is **not anonymous**. It is designed around data minimisation and least-privilege access.

## Data categories and purpose

| Category | Purpose | Typical access |
| --- | --- | --- |
| Account identity | Authentication, account management, approved support workflow | User and authorised account administrators |
| Assessments and wellbeing indicators | Voluntary check-ins and an internal early-support workflow | User receives confirmation only; authorised operational/clinical roles see what their explicit permission allows |
| Journal, voice transcript, and AI messages | User-requested reflection and AI-assisted support | User; authorised clinical-content roles only after a permission check and audit event |
| Audit logs | Security, access accountability, and incident investigation | Explicit audit-log permission |

Internal categories such as `ELEVATED` or `HIGH` are operational triage signals, not medical diagnoses. They are never returned from the assessment submission to the user.

## Consent and retention

The backend stores a version, purpose, timestamp, and status for assessment, journal processing, voice processing, and AI processing consent. Deployment owners must define jurisdiction-appropriate retention, withdrawal, export, deletion, and legal-hold policies before collecting real data.

## Security boundaries

Passwords use Argon2id-compatible library hashing; tokens and raw sensitive content are excluded from audit logs. Endpoint authorization is server enforced. Client-side route hiding is a convenience only. Any production deployment must add encryption-key management, verified backups, monitoring, a data-processing agreement with configured providers, and an independent security review.
