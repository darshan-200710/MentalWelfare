# Sentinel FastAPI service

This service is the API, operational wellbeing rules, RBAC policy enforcement, provider abstraction, and Postgres-ready persistence layer for Sentinel.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
pytest
```

The default `mock` AI provider produces deterministic development output without a key. It never diagnoses and checks potential high-risk language before producing a normal companion reply. Replace its implementation only through `app/ai/providers.py`, retaining the server-owned safety layer and human-review workflow.
