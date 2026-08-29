# Deployment

Sentinel must only be deployed after an organisational privacy, safeguarding, security, and clinical-governance review. It is not an emergency service or a diagnostic system.

## Docker Compose development stack

```powershell
Copy-Item .env.example .env
docker compose up --build
```

This starts the Next.js frontend on port 3000, FastAPI at port 8000, PostgreSQL, and Redis. The FastAPI service uses development-only mock AI/STT output; it is suitable for interface and workflow testing, not operational use.

## Local backend

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
Set-Location backend
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

For local Windows use, set `BACKEND_DATABASE_URL=sqlite:///./sentinel.db`. For a production-like stack, set `BACKEND_DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/sentinel` and configure a managed Redis instance.

## Production checklist

- Set a long unique `JWT_SECRET`, restrict `CORS_ORIGINS`, and terminate TLS at a reviewed proxy/load balancer.
- Run `alembic upgrade head`; do not use automatic `create_all` as the sole production migration process.
- Disable development seed accounts and replace the contact configuration before any user onboarding.
- Use managed, encrypted PostgreSQL backups and tested recovery procedures.
- Put uploaded audio in a protected object store with malware scanning; the development backend only validates MIME and size.
- Configure an approved OIDC/email/MFA provider before enabling those account pathways.
- Use a reviewed AI provider agreement, data-retention controls, monitoring, incident response, and human-review staffing.
