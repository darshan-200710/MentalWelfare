from sqlalchemy.orm import Session

from app.database.models import Alert, RiskEvent

RISK_ORDER = {"NORMAL": 0, "LOW": 1, "MODERATE": 2, "ELEVATED": 3, "HIGH": 4, "CRITICAL": 5}


def score_to_level(score: float) -> str:
    if score < 20: return "NORMAL"
    if score < 40: return "LOW"
    if score < 60: return "MODERATE"
    if score < 75: return "ELEVATED"
    if score < 90: return "HIGH"
    return "CRITICAL"


def record_signal(db: Session, *, user_id: str, source: str, level: str, confidence: float, signals: list[str]) -> RiskEvent:
    """Deterministic operational signal recorder. This is not a medical diagnosis."""
    event = RiskEvent(user_id=user_id, source=source, level=level, confidence=confidence, signals=signals)
    db.add(event)
    if RISK_ORDER.get(level, 0) >= RISK_ORDER["ELEVATED"]:
        severity = "CRITICAL" if level == "CRITICAL" else "HIGH" if level == "HIGH" else "MODERATE"
        db.add(Alert(user_id=user_id, severity=severity, source=source, reason="Operational wellbeing indicator requires authorised human review."))
    return event
