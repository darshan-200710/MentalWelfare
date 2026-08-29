from fastapi.testclient import TestClient
from uuid import uuid4

from app.main import app


def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_normal_user_cannot_access_admin_api() -> None:
    with TestClient(app) as client:
        response = client.post("/api/auth/register", json={"email": f"rbac-{uuid4().hex}@example.dev", "password": "VeryLongDevelopmentPassword!", "name": "RBAC Test"})
        assert response.status_code == 201
        token = response.json()["access_token"]
        assert client.get("/api/admin/personnel", headers=auth_header(token)).status_code == 403


def test_admin_without_clinical_permission_cannot_read_journals() -> None:
    with TestClient(app) as client:
        user = client.post("/api/auth/register", json={"email": f"journal-owner-{uuid4().hex}@example.dev", "password": "VeryLongDevelopmentPassword!", "name": "Journal Owner"}).json()
        client.post("/api/journals", headers=auth_header(user["access_token"]), json={"content": "A difficult and stressful day.", "status": "SUBMITTED"})
        admin = client.post("/api/auth/login", json={"email": "admin@sentinel.dev", "password": "Sentinel@2025"}).json()
        me = client.get("/api/auth/me", headers=auth_header(user["access_token"])).json()
        response = client.get(f"/api/admin/personnel/{me['id']}?include_sensitive=true", headers=auth_header(admin["access_token"]))
        assert response.status_code == 403
