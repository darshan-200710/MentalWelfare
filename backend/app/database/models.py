from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base


def id_column() -> Mapped[str]:
    return mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))


class Timestamped:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class User(Base, Timestamped):
    __tablename__ = "users"
    id = id_column()
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(512))
    name: Mapped[str | None] = mapped_column(String(160))
    service_number: Mapped[str | None] = mapped_column(String(64), unique=True)
    unit: Mapped[str | None] = mapped_column(String(160))
    role: Mapped[str] = mapped_column(String(48), default="USER", index=True)
    status: Mapped[str] = mapped_column(String(32), default="ACTIVE")
    first_login: Mapped[bool] = mapped_column(Boolean, default=True)
    onboarding_complete: Mapped[bool] = mapped_column(Boolean, default=False)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    failed_login_attempts: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    
    # New Auth Fields
    mfa_secret: Mapped[str | None] = mapped_column(String(128))
    recovery_codes: Mapped[list | None] = mapped_column(JSON)
    email_verification_token: Mapped[str | None] = mapped_column(String(256))
    email_verification_expires: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    password_reset_token: Mapped[str | None] = mapped_column(String(256))
    password_reset_expires: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class MFAToken(Base):
    __tablename__ = "mfa_tokens"
    id = id_column()
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    used: Mapped[bool] = mapped_column(Boolean, default=False)


class Role(Base):
    __tablename__ = "roles"
    id = id_column()
    name: Mapped[str] = mapped_column(String(48), unique=True)


class Permission(Base):
    __tablename__ = "permissions"
    id = id_column()
    name: Mapped[str] = mapped_column(String(64), unique=True)


class UserRole(Base):
    __tablename__ = "user_roles"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    role_id: Mapped[str] = mapped_column(ForeignKey("roles.id"), primary_key=True)


class RefreshSession(Base, Timestamped):
    __tablename__ = "refresh_sessions"
    id = id_column()
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AssessmentQuestion(Base, Timestamped):
    __tablename__ = "assessment_questions"
    id = id_column()
    question_text: Mapped[str] = mapped_column(Text)
    question_type: Mapped[str] = mapped_column(String(32), default="single_choice")
    options: Mapped[list] = mapped_column(JSON, default=list)
    scoring_metadata: Mapped[dict] = mapped_column(JSON, default=dict)
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class AssessmentSession(Base, Timestamped):
    __tablename__ = "assessment_sessions"
    id = id_column()
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AssessmentAnswer(Base, Timestamped):
    __tablename__ = "assessment_answers"
    id = id_column()
    session_id: Mapped[str] = mapped_column(ForeignKey("assessment_sessions.id"), index=True)
    question_id: Mapped[str] = mapped_column(ForeignKey("assessment_questions.id"))
    value: Mapped[str] = mapped_column(String(256))
    score: Mapped[float] = mapped_column(Float, default=0)


class AssessmentResult(Base, Timestamped):
    __tablename__ = "assessment_results"
    id = id_column()
    session_id: Mapped[str] = mapped_column(ForeignKey("assessment_sessions.id"), unique=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    normalized_score: Mapped[float] = mapped_column(Float)
    wellbeing_level: Mapped[str] = mapped_column(String(16), index=True)
    signals: Mapped[list] = mapped_column(JSON, default=list)


class DailyJournal(Base, Timestamped):
    __tablename__ = "daily_journals"
    id = id_column()
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    mood: Mapped[str | None] = mapped_column(String(16))
    content: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16), default="SUBMITTED")
    analysis: Mapped[dict | None] = mapped_column(JSON)


class VoiceEntry(Base, Timestamped):
    __tablename__ = "voice_entries"
    id = id_column()
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    mime_type: Mapped[str] = mapped_column(String(120))
    transcript: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="TRANSCRIBED")


class AIConversation(Base, Timestamped):
    __tablename__ = "ai_conversations"
    id = id_column()
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str | None] = mapped_column(String(160))


class AIMessage(Base, Timestamped):
    __tablename__ = "ai_messages"
    id = id_column()
    conversation_id: Mapped[str] = mapped_column(ForeignKey("ai_conversations.id"), index=True)
    role: Mapped[str] = mapped_column(String(16))
    content: Mapped[str] = mapped_column(Text)
    risk_flag: Mapped[bool] = mapped_column(Boolean, default=False)


class RiskEvent(Base, Timestamped):
    __tablename__ = "risk_events"
    id = id_column()
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    level: Mapped[str] = mapped_column(String(16), index=True)
    source: Mapped[str] = mapped_column(String(48))
    confidence: Mapped[float] = mapped_column(Float)
    signals: Mapped[list] = mapped_column(JSON, default=list)


class Alert(Base, Timestamped):
    __tablename__ = "alerts"
    id = id_column()
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    severity: Mapped[str] = mapped_column(String(16), index=True)
    reason: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(48))
    status: Mapped[str] = mapped_column(String(24), default="OPEN", index=True)
    assigned_to: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class SupportRequest(Base, Timestamped):
    __tablename__ = "support_requests"
    id = id_column()
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    type: Mapped[str] = mapped_column(String(48))
    message: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(24), default="OPEN")
    assigned_to: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Notification(Base, Timestamped):
    __tablename__ = "notifications"
    id = id_column()
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(180))
    body: Mapped[str | None] = mapped_column(Text)
    read: Mapped[bool] = mapped_column(Boolean, default=False)


class ConsentRecord(Base, Timestamped):
    __tablename__ = "consent_records"
    id = id_column()
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    purpose: Mapped[str] = mapped_column(String(64))
    version: Mapped[str] = mapped_column(String(24))
    status: Mapped[str] = mapped_column(String(16))


class Resource(Base, Timestamped):
    __tablename__ = "resources"
    id = id_column()
    title: Mapped[str] = mapped_column(String(180))
    summary: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(64), index=True)
    body: Mapped[str] = mapped_column(Text)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class SupportContact(Base, Timestamped):
    __tablename__ = "support_contacts"
    id = id_column()
    label: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text)
    contact: Mapped[str] = mapped_column(String(512))
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = id_column()
    actor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), index=True)
    action: Mapped[str] = mapped_column(String(96), index=True)
    target_type: Mapped[str | None] = mapped_column(String(64))
    target_id: Mapped[str | None] = mapped_column(String(64))
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSON)
    ip_hash: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
