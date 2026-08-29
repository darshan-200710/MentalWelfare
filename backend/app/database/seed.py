from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.database.models import AssessmentQuestion, Resource, SupportContact, User

QUESTIONS = [
    ("Over the past week, how manageable has your day-to-day pressure felt?", [("very_manageable", "Very manageable", 0), ("manageable", "Manageable", 1), ("difficult", "Difficult", 3), ("overwhelming", "Overwhelming", 5)]),
    ("How has your sleep felt recently?", [("restful", "Restful", 0), ("mixed", "Mixed", 2), ("disrupted", "Frequently disrupted", 4), ("very_disrupted", "Very disrupted", 5)]),
    ("How connected have you felt to people you trust?", [("connected", "Connected", 0), ("somewhat", "Somewhat connected", 1), ("distant", "Distant", 3), ("isolated", "Isolated", 5)]),
    ("How often have you been able to recover after demanding moments?", [("often", "Often", 0), ("sometimes", "Sometimes", 2), ("rarely", "Rarely", 4), ("not_at_all", "Not at all", 5)]),
    ("How would you describe your current energy?", [("steady", "Steady", 0), ("variable", "Variable", 2), ("low", "Low", 4), ("exhausted", "Exhausted", 5)]),
]


def seed_development_data(db: Session) -> None:
    if not db.scalar(select(AssessmentQuestion.id).limit(1)):
        for index, (text, options) in enumerate(QUESTIONS):
            db.add(AssessmentQuestion(question_text=text, options=[{"value": value, "label": label, "score": score} for value, label, score in options], sort_order=index))
    accounts = [
        ("superadmin@sentinel.dev", "SUPER_ADMIN", "Chief Medical Officer"),
        ("admin@sentinel.dev", "ADMIN", "Development Admin"),
        ("supervisor@sentinel.dev", "SUPERVISOR", "Unit Commander"),
        ("pro@sentinel.dev", "MENTAL_HEALTH_PROFESSIONAL", "Clinical Psychologist"),
        ("user@sentinel.dev", "USER", "Havildar Rajesh Kumar"),
    ]
    for email, role, name in accounts:
        if not db.scalar(select(User).where(User.email == email)):
            db.add(User(email=email, role=role, name=name, password_hash=hash_password("Sentinel@2025"), first_login=(role == "USER"), onboarding_complete=(role != "USER")))
    if not db.scalar(select(Resource.id).limit(1)):
        db.add_all([
            Resource(title="A short reset after a demanding day", summary="A brief paced-breathing exercise you can use privately.", category="Relaxation", body="Breathe in gently, pause, and breathe out more slowly. Repeat at a comfortable pace for two minutes."),
            Resource(title="Supporting healthy sleep", summary="Practical approaches for recovering a predictable wind-down routine.", category="Sleep", body="Choose one consistent cue to begin winding down and limit stimulation immediately before rest."),
        ])
    if not db.scalar(select(SupportContact.id).limit(1)):
        db.add(SupportContact(label="Organisation support contact", description="Deployment owners must replace this development record with a designated route.", contact="Configure via administration before production."))
    db.commit()
