from fastapi.testclient import TestClient
from uuid import uuid4

from app.main import app


def test_assessment_is_server_scored_and_hides_indicator() -> None:
    with TestClient(app) as client:
        token = client.post("/api/auth/register", json={"email": f"assessment-{uuid4().hex}@example.dev", "password": "VeryLongDevelopmentPassword!"}).json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        questions = client.get("/api/assessments/current", headers=headers).json()["questions"]
        answers = [{"question_id": question["id"], "value": question["options"][0]["value"]} for question in questions]
        response = client.post("/api/assessments", headers=headers, json={"answers": answers})
        assert response.status_code == 200
        assert response.json() == {"message": "Your check-in has been recorded."}
