from collections.abc import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.database.models import User
from app.database.session import get_db

bearer = HTTPBearer(auto_error=False)

ROLE_PERMISSIONS: dict[str, set[str]] = {
    "USER": set(),
    "SUPERVISOR": {"VIEW_USER_PROFILE", "VIEW_RISK_INDICATOR", "MANAGE_ALERTS"},
    "MENTAL_HEALTH_PROFESSIONAL": {"VIEW_USER_PROFILE", "VIEW_ASSESSMENT", "VIEW_JOURNAL", "VIEW_AI_CONVERSATION", "VIEW_RISK_INDICATOR", "MANAGE_ALERTS", "MANAGE_RESOURCES"},
    "ADMIN": {"VIEW_USER_PROFILE", "VIEW_RISK_INDICATOR", "MANAGE_ALERTS", "MANAGE_USERS", "VIEW_ANALYTICS", "VIEW_AUDIT_LOGS", "MANAGE_SYSTEM", "MANAGE_RESOURCES", "MANAGE_EMERGENCY_CONTACTS", "MANAGE_ASSESSMENT_QUESTIONS"},
    "SUPER_ADMIN": {"VIEW_USER_PROFILE", "VIEW_ASSESSMENT", "VIEW_JOURNAL", "VIEW_AI_CONVERSATION", "VIEW_RISK_INDICATOR", "MANAGE_ALERTS", "MANAGE_USERS", "VIEW_ANALYTICS", "VIEW_AUDIT_LOGS", "MANAGE_SYSTEM", "MANAGE_RESOURCES", "MANAGE_EMERGENCY_CONTACTS", "MANAGE_ASSESSMENT_QUESTIONS"},
}


def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)) -> User:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    subject = decode_access_token(credentials.credentials)["sub"]
    user = db.get(User, subject)
    if not user or user.status != "ACTIVE":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session is no longer active")
    return user


def require_permission(permission: str) -> Callable[[User], User]:
    def dependency(user: User = Depends(current_user)) -> User:
        if permission not in ROLE_PERMISSIONS.get(user.role, set()):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to perform this action")
        return user
    return dependency
