import csv
import io
import secrets
from datetime import UTC, datetime
import httpx

from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile, File
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import ROLE_PERMISSIONS, require_permission, current_user
from app.database.models import AIConversation, AIMessage, Alert, AssessmentResult, AuditLog, DailyJournal, RiskEvent, SupportRequest, User
from app.database.session import get_db
from app.schemas import (
    AlertUpdateRequest, CreateUserRequest, AdminUpdateUserRequest, BulkImportResult,
    ResourceRequest, ResourceResponse, EmergencyContactRequest, EmergencyContactResponse,
    AssessmentQuestionRequest
)
from app.services.audit import log_audit

router = APIRouter(prefix="/api/admin", tags=["Administration"])


def profile(user: User) -> dict:
    return {"id": user.id, "name": user.name, "email": user.email, "service_number": user.service_number, "unit": user.unit, "status": user.status}


@router.get("/dashboard")
def dashboard(request: Request, actor: User = Depends(require_permission("VIEW_USER_PROFILE")), db: Session = Depends(get_db)) -> dict:
    total = db.scalar(select(func.count()).select_from(User).where(User.role == "USER")) or 0
    active = db.scalar(select(func.count()).select_from(User).where(User.role == "USER", User.status == "ACTIVE")) or 0
    risks = {level: db.scalar(select(func.count()).select_from(RiskEvent).where(RiskEvent.level == level)) or 0 for level in ("ELEVATED", "HIGH", "CRITICAL")}
    log_audit(db, request=request, actor_id=actor.id, action="admin_dashboard_viewed"); db.commit()
    return {"total_personnel": total, "active_users": active, "elevated_indicators": risks["ELEVATED"], "high_indicators": risks["HIGH"], "critical_alerts": risks["CRITICAL"]}


@router.get("/personnel")
def personnel(
    request: Request,
    q: str = Query("", max_length=120), page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=100),
    actor: User = Depends(require_permission("VIEW_USER_PROFILE")), db: Session = Depends(get_db),
) -> dict:
    statement = select(User).where(User.role == "USER")
    if q:
        term = f"%{q}%"
        statement = statement.where((User.name.ilike(term)) | (User.service_number.ilike(term)) | (User.unit.ilike(term)))
    total = db.scalar(select(func.count()).select_from(statement.subquery())) or 0
    users = db.scalars(statement.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    rows = []
    for person in users:
        last_risk = db.scalar(select(RiskEvent).where(RiskEvent.user_id == person.id).order_by(RiskEvent.created_at.desc()))
        rows.append({**profile(person), "wellbeing_indicator": last_risk.level if last_risk else "NORMAL", "last_check_in": last_risk.created_at if last_risk else None})
    log_audit(db, request=request, actor_id=actor.id, action="admin_view_personnel"); db.commit()
    return {"items": rows, "page": page, "page_size": page_size, "total": total}


@router.get("/personnel/{user_id}")
def person_detail(
    user_id: str, request: Request, include_sensitive: bool = False,
    actor: User = Depends(require_permission("VIEW_USER_PROFILE")), db: Session = Depends(get_db),
) -> dict:
    person = db.get(User, user_id)
    if not person or person.role != "USER":
        raise HTTPException(status_code=404, detail="Personnel record not found")
    latest_risk = db.scalar(select(RiskEvent).where(RiskEvent.user_id == user_id).order_by(RiskEvent.created_at.desc()))
    result: dict = {"profile": profile(person), "wellbeing_indicator": latest_risk.level if latest_risk else "NORMAL", "support_requests": [{"id": item.id, "type": item.type, "status": item.status, "created_at": item.created_at} for item in db.scalars(select(SupportRequest).where(SupportRequest.user_id == user_id)).all()]}
    if include_sensitive:
        permissions = ROLE_PERMISSIONS.get(actor.role, set())
        if "VIEW_JOURNAL" not in permissions:
            raise HTTPException(status_code=403, detail="Explicit sensitive-content permission is required")
        result["journals"] = [{"id": item.id, "content": item.content, "created_at": item.created_at} for item in db.scalars(select(DailyJournal).where(DailyJournal.user_id == user_id).order_by(DailyJournal.created_at.desc())).all()]
        if "VIEW_AI_CONVERSATION" in permissions:
            conversations = db.scalars(select(AIConversation).where(AIConversation.user_id == user_id)).all()
            result["conversations"] = [{"id": conv.id, "messages": [{"role": msg.role, "content": msg.content, "created_at": msg.created_at} for msg in db.scalars(select(AIMessage).where(AIMessage.conversation_id == conv.id)).all()]} for conv in conversations]
        log_audit(db, request=request, actor_id=actor.id, action="sensitive_access", target_type="User", target_id=user_id)
    log_audit(db, request=request, actor_id=actor.id, action="user_profile_access", target_type="User", target_id=user_id)
    db.commit()
    return result


@router.get("/risk")
def risk_monitoring(actor: User = Depends(require_permission("VIEW_RISK_INDICATOR")), db: Session = Depends(get_db)) -> dict:
    distribution = {level: db.scalar(select(func.count()).select_from(RiskEvent).where(RiskEvent.level == level)) or 0 for level in ("NORMAL", "LOW", "MODERATE", "ELEVATED", "HIGH", "CRITICAL")}
    events = db.scalars(select(RiskEvent).order_by(RiskEvent.created_at.desc()).limit(100)).all()
    return {"distribution": distribution, "recent_events": [{"id": item.id, "user_id": item.user_id, "level": item.level, "source": item.source, "created_at": item.created_at} for item in events]}


@router.get("/alerts")
def alerts(actor: User = Depends(require_permission("MANAGE_ALERTS")), db: Session = Depends(get_db)) -> dict:
    items = db.scalars(select(Alert).order_by(Alert.created_at.desc())).all()
    return {"alerts": [{"id": item.id, "user_id": item.user_id, "severity": item.severity, "reason": item.reason, "source": item.source, "status": item.status, "assigned_to": item.assigned_to, "created_at": item.created_at} for item in items]}


@router.put("/alerts/{alert_id}")
def update_alert(alert_id: str, payload: AlertUpdateRequest, request: Request, actor: User = Depends(require_permission("MANAGE_ALERTS")), db: Session = Depends(get_db)) -> dict:
    item = db.get(Alert, alert_id)
    if not item:
        raise HTTPException(status_code=404, detail="Alert not found")
    item.status, item.assigned_to = payload.status, payload.assigned_to
    if payload.status == "RESOLVED": item.resolved_at = datetime.now(UTC)
    log_audit(db, request=request, actor_id=actor.id, action="alert_updated", target_type="Alert", target_id=item.id, metadata={"status": payload.status})
    db.commit(); return {"id": item.id, "status": item.status}


@router.get("/analytics")
def analytics(actor: User = Depends(require_permission("VIEW_ANALYTICS")), db: Session = Depends(get_db)) -> dict:
    by_unit = db.execute(select(User.unit, func.count(User.id)).where(User.role == "USER").group_by(User.unit)).all()
    return {"personnel_by_unit": [{"unit": unit or "Unassigned", "count": count} for unit, count in by_unit]}


@router.get("/audit-logs")
def audit_logs(limit: int = Query(100, ge=1, le=500), actor: User = Depends(require_permission("VIEW_AUDIT_LOGS")), db: Session = Depends(get_db)) -> dict:
    items = db.scalars(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)).all()
    return {"logs": [{"id": item.id, "actor_id": item.actor_id, "action": item.action, "target_type": item.target_type, "target_id": item.target_id, "metadata": item.metadata_, "created_at": item.created_at} for item in items]}

# Phase 3 additions

@router.post("/users")
def create_user(payload: CreateUserRequest, request: Request, actor: User = Depends(require_permission("MANAGE_USERS")), db: Session = Depends(get_db)) -> dict:
    from app.core.security import get_password_hash
    existing_user = db.scalar(select(User).where(User.email == payload.email))
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    temp_password = secrets.token_urlsafe(12)
    user = User(
        email=payload.email,
        name=payload.name,
        role=payload.role,
        unit=payload.unit,
        service_number=payload.service_number,
        hashed_password=get_password_hash(temp_password)
    )
    db.add(user)
    log_audit(db, request=request, actor_id=actor.id, action="user_created", target_type="User", target_id=user.id)
    db.commit()
    db.refresh(user)
    return {"user": profile(user), "temp_password": temp_password}

@router.put("/users/{user_id}")
def update_user(user_id: str, payload: AdminUpdateUserRequest, request: Request, actor: User = Depends(require_permission("MANAGE_USERS")), db: Session = Depends(get_db)) -> dict:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.role == "SUPER_ADMIN" and actor.role == "ADMIN":
        raise HTTPException(status_code=403, detail="Admin cannot modify super_admin")

    if payload.name is not None: user.name = payload.name
    if payload.role is not None: user.role = payload.role
    if payload.unit is not None: user.unit = payload.unit
    if payload.status is not None: user.status = payload.status

    log_audit(db, request=request, actor_id=actor.id, action="user_updated", target_type="User", target_id=user.id)
    db.commit()
    return profile(user)

@router.post("/users/{user_id}/suspend")
def suspend_user(user_id: str, request: Request, actor: User = Depends(require_permission("MANAGE_USERS")), db: Session = Depends(get_db)) -> dict:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == "SUPER_ADMIN" and actor.role == "ADMIN":
        raise HTTPException(status_code=403, detail="Admin cannot modify super_admin")
        
    user.status = "SUSPENDED"
    log_audit(db, request=request, actor_id=actor.id, action="user_suspended", target_type="User", target_id=user.id)
    db.commit()
    return {"message": "User suspended"}

@router.post("/users/{user_id}/activate")
def activate_user(user_id: str, request: Request, actor: User = Depends(require_permission("MANAGE_USERS")), db: Session = Depends(get_db)) -> dict:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.status = "ACTIVE"
    log_audit(db, request=request, actor_id=actor.id, action="user_activated", target_type="User", target_id=user.id)
    db.commit()
    return {"message": "User activated"}

@router.post("/users/{user_id}/unlock")
def unlock_user(user_id: str, request: Request, actor: User = Depends(require_permission("MANAGE_USERS")), db: Session = Depends(get_db)) -> dict:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if hasattr(user, 'failed_login_attempts'): user.failed_login_attempts = 0
    if hasattr(user, 'locked_until'): user.locked_until = None
        
    log_audit(db, request=request, actor_id=actor.id, action="user_unlocked", target_type="User", target_id=user.id)
    db.commit()
    return {"message": "User unlocked"}

@router.post("/users/{user_id}/reset-password")
def reset_password(user_id: str, request: Request, actor: User = Depends(require_permission("MANAGE_USERS")), db: Session = Depends(get_db)) -> dict:
    from app.core.security import get_password_hash
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == "SUPER_ADMIN" and actor.role == "ADMIN":
        raise HTTPException(status_code=403, detail="Admin cannot modify super_admin")
        
    temp_password = secrets.token_urlsafe(12)
    user.hashed_password = get_password_hash(temp_password)
    
    log_audit(db, request=request, actor_id=actor.id, action="user_password_reset", target_type="User", target_id=user.id)
    db.commit()
    return {"temp_password": temp_password}

@router.post("/users/bulk-import")
async def bulk_import(request: Request, file: UploadFile = File(...), actor: User = Depends(require_permission("MANAGE_USERS")), db: Session = Depends(get_db)) -> BulkImportResult:
    from app.core.security import get_password_hash
    content = await file.read()
    decoded = content.decode("utf-8")
    reader = csv.DictReader(io.StringIO(decoded))
    
    created = 0
    errors = []
    total = 0
    
    for row in reader:
        total += 1
        try:
            email = row.get("email")
            if db.scalar(select(User).where(User.email == email)):
                errors.append({"row": total, "error": f"Email {email} already exists"})
                continue
                
            temp_password = secrets.token_urlsafe(12)
            user = User(
                email=email,
                name=row.get("name"),
                role=row.get("role", "USER"),
                unit=row.get("unit"),
                service_number=row.get("service_number"),
                hashed_password=get_password_hash(temp_password)
            )
            db.add(user)
            created += 1
        except Exception as e:
            errors.append({"row": total, "error": str(e)})
            
    log_audit(db, request=request, actor_id=actor.id, action="bulk_user_import")
    db.commit()
    return BulkImportResult(created=created, errors=errors, total=total)


@router.get("/resources")
def list_resources(actor: User = Depends(require_permission("MANAGE_SYSTEM")), db: Session = Depends(get_db)) -> dict:
    from app.database.models import Resource # type: ignore
    items = db.scalars(select(Resource)).all()
    return {"resources": items}

@router.post("/resources")
def create_resource(payload: ResourceRequest, request: Request, actor: User = Depends(require_permission("MANAGE_SYSTEM")), db: Session = Depends(get_db)) -> dict:
    from app.database.models import Resource # type: ignore
    resource = Resource(title=payload.title, summary=payload.summary, category=payload.category, body=payload.body)
    db.add(resource)
    log_audit(db, request=request, actor_id=actor.id, action="resource_created")
    db.commit()
    db.refresh(resource)
    return resource

@router.put("/resources/{id}")
def update_resource(id: str, payload: ResourceRequest, request: Request, actor: User = Depends(require_permission("MANAGE_SYSTEM")), db: Session = Depends(get_db)) -> dict:
    from app.database.models import Resource # type: ignore
    resource = db.get(Resource, id)
    if not resource: raise HTTPException(status_code=404, detail="Resource not found")
    resource.title = payload.title
    resource.summary = payload.summary
    resource.category = payload.category
    resource.body = payload.body
    log_audit(db, request=request, actor_id=actor.id, action="resource_updated", target_id=id)
    db.commit()
    return resource

@router.delete("/resources/{id}")
def delete_resource(id: str, request: Request, actor: User = Depends(require_permission("MANAGE_SYSTEM")), db: Session = Depends(get_db)) -> dict:
    from app.database.models import Resource # type: ignore
    resource = db.get(Resource, id)
    if not resource: raise HTTPException(status_code=404, detail="Resource not found")
    resource.active = False
    log_audit(db, request=request, actor_id=actor.id, action="resource_deleted", target_id=id)
    db.commit()
    return {"message": "Resource deactivated"}

@router.get("/emergency-contacts")
def list_contacts(actor: User = Depends(require_permission("MANAGE_SYSTEM")), db: Session = Depends(get_db)) -> dict:
    from app.database.models import EmergencyContact # type: ignore
    items = db.scalars(select(EmergencyContact)).all()
    return {"contacts": items}

@router.post("/emergency-contacts")
def create_contact(payload: EmergencyContactRequest, request: Request, actor: User = Depends(require_permission("MANAGE_SYSTEM")), db: Session = Depends(get_db)) -> dict:
    from app.database.models import EmergencyContact # type: ignore
    contact = EmergencyContact(label=payload.label, description=payload.description, contact=payload.contact)
    db.add(contact)
    log_audit(db, request=request, actor_id=actor.id, action="contact_created")
    db.commit()
    db.refresh(contact)
    return contact

@router.put("/emergency-contacts/{id}")
def update_contact(id: str, payload: EmergencyContactRequest, request: Request, actor: User = Depends(require_permission("MANAGE_SYSTEM")), db: Session = Depends(get_db)) -> dict:
    from app.database.models import EmergencyContact # type: ignore
    contact = db.get(EmergencyContact, id)
    if not contact: raise HTTPException(status_code=404, detail="Contact not found")
    contact.label = payload.label
    contact.description = payload.description
    contact.contact = payload.contact
    log_audit(db, request=request, actor_id=actor.id, action="contact_updated", target_id=id)
    db.commit()
    return contact

@router.delete("/emergency-contacts/{id}")
def delete_contact(id: str, request: Request, actor: User = Depends(require_permission("MANAGE_SYSTEM")), db: Session = Depends(get_db)) -> dict:
    from app.database.models import EmergencyContact # type: ignore
    contact = db.get(EmergencyContact, id)
    if not contact: raise HTTPException(status_code=404, detail="Contact not found")
    contact.active = False
    log_audit(db, request=request, actor_id=actor.id, action="contact_deleted", target_id=id)
    db.commit()
    return {"message": "Contact deactivated"}

@router.get("/assessment-questions")
def list_questions(actor: User = Depends(require_permission("MANAGE_SYSTEM")), db: Session = Depends(get_db)) -> dict:
    from app.database.models import AssessmentQuestion # type: ignore
    items = db.scalars(select(AssessmentQuestion)).all()
    return {"questions": items}

@router.post("/assessment-questions")
def create_question(payload: AssessmentQuestionRequest, request: Request, actor: User = Depends(require_permission("MANAGE_SYSTEM")), db: Session = Depends(get_db)) -> dict:
    from app.database.models import AssessmentQuestion # type: ignore
    question = AssessmentQuestion(
        question_text=payload.question_text,
        question_type=payload.question_type,
        options=payload.options,
        scoring_metadata=payload.scoring_metadata,
        sort_order=payload.sort_order
    )
    db.add(question)
    log_audit(db, request=request, actor_id=actor.id, action="question_created")
    db.commit()
    db.refresh(question)
    return question

@router.put("/assessment-questions/{id}")
def update_question(id: str, payload: AssessmentQuestionRequest, request: Request, actor: User = Depends(require_permission("MANAGE_SYSTEM")), db: Session = Depends(get_db)) -> dict:
    from app.database.models import AssessmentQuestion # type: ignore
    question = db.get(AssessmentQuestion, id)
    if not question: raise HTTPException(status_code=404, detail="Question not found")
    question.question_text = payload.question_text
    question.question_type = payload.question_type
    question.options = payload.options
    question.scoring_metadata = payload.scoring_metadata
    question.sort_order = payload.sort_order
    log_audit(db, request=request, actor_id=actor.id, action="question_updated", target_id=id)
    db.commit()
    return question

@router.delete("/assessment-questions/{id}")
def delete_question(id: str, request: Request, actor: User = Depends(require_permission("MANAGE_SYSTEM")), db: Session = Depends(get_db)) -> dict:
    from app.database.models import AssessmentQuestion # type: ignore
    question = db.get(AssessmentQuestion, id)
    if not question: raise HTTPException(status_code=404, detail="Question not found")
    question.active = False
    log_audit(db, request=request, actor_id=actor.id, action="question_deleted", target_id=id)
    db.commit()
    return {"message": "Question deactivated"}

@router.get("/ml-status")
async def ml_status(actor: User = Depends(require_permission("VIEW_ANALYTICS"))) -> dict:
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get("http://ml-service:8000/api/ml/health")
            response.raise_for_status()
            return response.json()
        except httpx.RequestError:
            raise HTTPException(status_code=503, detail="ML Service unavailable")
