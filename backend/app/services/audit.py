from hashlib import sha256

from fastapi import Request
from sqlalchemy.orm import Session

from app.database.models import AuditLog


def log_audit(db: Session, *, request: Request | None, actor_id: str | None, action: str, target_type: str | None = None, target_id: str | None = None, metadata: dict | None = None) -> None:
    """Record a minimised audit event; never include raw journal/chat/password content."""
    ip_hash = None
    if request and request.client:
        ip_hash = sha256(request.client.host.encode()).hexdigest()
    db.add(AuditLog(actor_id=actor_id, action=action, target_type=target_type, target_id=target_id, metadata_=metadata, ip_hash=ip_hash))
