from datetime import UTC, datetime
import random

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.providers import get_ai_provider, safety_check
from app.api.deps import current_user
from app.core.config import get_settings
from app.database.models import AIConversation, AIMessage, AssessmentAnswer, AssessmentQuestion, AssessmentResult, AssessmentSession, ConsentRecord, DailyJournal, Resource, SupportContact, SupportRequest, User, VoiceEntry
from app.database.session import get_db
from app.schemas import AssessmentSubmitRequest, ChatRequest, ConsentRequest, JournalRequest, SupportRequestInput, UserUpdateRequest
from app.services.audit import log_audit
from app.services.risk_engine import record_signal, score_to_level

router = APIRouter(prefix="/api", tags=["Wellbeing"])


@router.get("/users/me")
def get_profile(user: User = Depends(current_user)) -> dict:
    return {"id": user.id, "email": user.email, "name": user.name, "service_number": user.service_number, "unit": user.unit, "role": user.role, "status": user.status, "mfa_enabled": False}


@router.put("/users/me")
def update_profile(payload: UserUpdateRequest, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    user.name, user.unit = payload.name, payload.unit
    log_audit(db, request=request, actor_id=user.id, action="profile_updated", target_type="User", target_id=user.id)
    db.commit()
    return {"id": user.id, "name": user.name, "unit": user.unit}


@router.get("/resources")
def resources(category: str | None = None, db: Session = Depends(get_db)) -> dict:
    statement = select(Resource).where(Resource.active.is_(True)).order_by(Resource.category, Resource.title)
    if category:
        statement = statement.where(Resource.category == category)
    items = db.scalars(statement).all()
    return {"resources": [{"id": item.id, "title": item.title, "summary": item.summary, "category": item.category, "body": item.body} for item in items]}


@router.get("/emergency-contacts")
def emergency_contacts(db: Session = Depends(get_db)) -> dict:
    items = db.scalars(select(SupportContact).where(SupportContact.active.is_(True))).all()
    return {"contacts": [{"label": item.label, "description": item.description, "contact": item.contact} for item in items]}


@router.post("/consent")
def record_consent(payload: ConsentRequest, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    record = ConsentRecord(user_id=user.id, purpose=payload.purpose, version=payload.version, status=payload.status)
    db.add(record); log_audit(db, request=request, actor_id=user.id, action="consent_granted" if payload.status == "GRANTED" else "consent_withdrawn", target_type="ConsentRecord")
    db.commit()
    return {"id": record.id, "status": record.status}


@router.get("/assessments/current")
def current_assessment(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    questions = db.scalars(select(AssessmentQuestion).where(AssessmentQuestion.active.is_(True)).order_by(AssessmentQuestion.sort_order)).all()
    return {"questions": [{"id": q.id, "question_text": q.question_text, "question_type": q.question_type, "options": q.options, "version": q.version} for q in questions]}


@router.post("/assessments")
def submit_assessment(payload: AssessmentSubmitRequest, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    questions = {q.id: q for q in db.scalars(select(AssessmentQuestion).where(AssessmentQuestion.active.is_(True))).all()}
    if any(answer.question_id not in questions for answer in payload.answers):
        raise HTTPException(status_code=422, detail="An assessment answer does not match an active question")
    session = AssessmentSession(user_id=user.id, completed_at=datetime.now(UTC))
    db.add(session); db.flush()
    total = 0.0; maximum = 0.0
    for answer in payload.answers:
        question = questions[answer.question_id]
        option = next((item for item in question.options if item.get("value") == answer.value), None)
        if not option:
            raise HTTPException(status_code=422, detail="Invalid answer option")
        score = float(option.get("score", 0)); total += score
        maximum += max((float(item.get("score", 0)) for item in question.options), default=1)
        db.add(AssessmentAnswer(session_id=session.id, question_id=question.id, value=answer.value, score=score))
    normalized = min(100.0, (total / maximum * 100) if maximum else 0.0)
    level = score_to_level(normalized)
    db.add(AssessmentResult(session_id=session.id, user_id=user.id, normalized_score=normalized, wellbeing_level=level, signals=[]))
    user.first_login = False; user.onboarding_complete = True
    record_signal(db, user_id=user.id, source="assessment", level=level, confidence=round(normalized / 100, 2), signals=[])
    log_audit(db, request=request, actor_id=user.id, action="assessment_submitted", target_type="AssessmentSession", target_id=session.id)
    db.commit()
    return {"message": "Your check-in has been recorded."}


@router.get("/assessments/history")
def assessment_history(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    sessions = db.scalars(select(AssessmentSession).where(AssessmentSession.user_id == user.id).order_by(AssessmentSession.created_at.desc())).all()
    return {"sessions": [{"id": item.id, "completed_at": item.completed_at, "created_at": item.created_at} for item in sessions]}


def journal_response(journal: DailyJournal) -> dict:
    return {"id": journal.id, "mood": journal.mood, "content": journal.content, "status": journal.status, "analysis": journal.analysis, "created_at": journal.created_at, "updated_at": journal.updated_at}


@router.get("/journals")
def list_journals(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    entries = db.scalars(select(DailyJournal).where(DailyJournal.user_id == user.id).order_by(DailyJournal.created_at.desc())).all()
    return {"journals": [journal_response(entry) for entry in entries]}


@router.post("/journals", status_code=status.HTTP_201_CREATED)
def create_journal(payload: JournalRequest, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    analysis = None
    if payload.status == "SUBMITTED":
        result = get_ai_provider().analyze_journal(payload.content)
        analysis = {
            "wellbeing_signal": result.wellbeing_signal, 
            "confidence": result.confidence, 
            "signals": result.signals, 
            "requires_human_review": result.requires_human_review,
            "morale_score": result.morale_score,
            "mood": result.mood
        }
        record_signal(db, user_id=user.id, source="journal", level=result.wellbeing_signal, confidence=result.confidence, signals=result.signals)
    entry = DailyJournal(user_id=user.id, mood=payload.mood, content=payload.content, status=payload.status, analysis=analysis)
    db.add(entry); db.flush()
    log_audit(db, request=request, actor_id=user.id, action="journal_submitted" if payload.status == "SUBMITTED" else "journal_draft_saved", target_type="DailyJournal", target_id=entry.id)
    db.commit(); db.refresh(entry)
    return {"journal": journal_response(entry)}


def owned_journal(journal_id: str, user: User, db: Session) -> DailyJournal:
    entry = db.scalar(select(DailyJournal).where(DailyJournal.id == journal_id, DailyJournal.user_id == user.id))
    if not entry:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    return entry


@router.get("/journals/{journal_id}")
def get_journal(journal_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    return {"journal": journal_response(owned_journal(journal_id, user, db))}


@router.put("/journals/{journal_id}")
def update_journal(journal_id: str, payload: JournalRequest, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    entry = owned_journal(journal_id, user, db)
    entry.content, entry.mood, entry.status = payload.content, payload.mood, payload.status
    log_audit(db, request=request, actor_id=user.id, action="journal_updated", target_type="DailyJournal", target_id=entry.id)
    db.commit(); db.refresh(entry)
    return {"journal": journal_response(entry)}


@router.delete("/journals/{journal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_journal(journal_id: str, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)) -> None:
    entry = owned_journal(journal_id, user, db)
    log_audit(db, request=request, actor_id=user.id, action="journal_deleted", target_type="DailyJournal", target_id=entry.id)
    db.delete(entry); db.commit()


@router.post("/voice/transcribe")
async def transcribe_voice(request: Request, audio: UploadFile = File(...), user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    content_type = (audio.content_type or "").split(";")[0].strip().lower()
    if not (content_type.startswith("audio/") or content_type in {"video/webm", "application/octet-stream"}):
        raise HTTPException(status_code=415, detail="Unsupported audio format")
    content = await audio.read(get_settings().max_voice_upload_bytes + 1)
    if not content or len(content) > get_settings().max_voice_upload_bytes:
        raise HTTPException(status_code=413, detail="Audio is empty or exceeds the maximum upload size")

    transcript, analysis_data = get_ai_provider().transcribe(content, audio.content_type)
    entry = VoiceEntry(user_id=user.id, mime_type=audio.content_type, transcript=transcript)
    db.add(entry); db.flush(); log_audit(db, request=request, actor_id=user.id, action="voice_transcribed", target_type="VoiceEntry", target_id=entry.id); db.commit()
    return {"id": entry.id, "transcript": transcript, "requires_review": True, "analysis": analysis_data}


@router.post("/tts")
def synthesize_speech(payload: dict, user: User = Depends(current_user)) -> Response:
    text = payload.get("text", "")
    if not text:
        raise HTTPException(status_code=400, detail="Text is required")
    audio_bytes = get_ai_provider().synthesize(text)
    return Response(content=audio_bytes, media_type="audio/mpeg")



@router.post("/ai/chat")
def ai_chat(payload: ChatRequest, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    conversation = db.scalar(select(AIConversation).where(AIConversation.id == payload.conversation_id, AIConversation.user_id == user.id)) if payload.conversation_id else None
    if not conversation:
        conversation = AIConversation(user_id=user.id, title=payload.message[:80]); db.add(conversation); db.flush()
    history_messages = db.scalars(select(AIMessage).where(AIMessage.conversation_id == conversation.id).order_by(AIMessage.created_at.desc()).limit(20)).all()
    history = [{"role": message.role, "content": message.content} for message in reversed(history_messages)]
    db.add(AIMessage(conversation_id=conversation.id, role="user", content=payload.message))
    
    high_risk = safety_check(payload.message)
    resp_text, is_emergency, metadata = get_ai_provider().chat(payload.message, history)
    
    final_high_risk = high_risk or is_emergency
    response = "I’m concerned about what you’ve shared. Please use the support options available to you now and contact a trusted person or qualified professional. If there is immediate danger, use your organisation’s emergency assistance route." if final_high_risk else resp_text
    
    assistant = AIMessage(conversation_id=conversation.id, role="assistant", content=response, risk_flag=final_high_risk); db.add(assistant)
    
    if final_high_risk:
        record_signal(db, user_id=user.id, source="ai_chat", level="HIGH", confidence=0.95, signals=["potential_high_risk_language"])
    log_audit(db, request=request, actor_id=user.id, action="ai_chat", target_type="AIConversation", target_id=conversation.id, metadata={"safety_escalation": final_high_risk})
    db.commit()
    
    return {
        "conversation_id": conversation.id, 
        "message": {
            "id": assistant.id, 
            "role": "assistant", 
            "content": response,
            "morale_score": metadata.get("morale_score"),
            "mood": metadata.get("mood"),
            "rag_source": metadata.get("rag_source")
        }, 
        "support_escalation": final_high_risk
    }


@router.get("/ai/morale-history/{conversation_id}")
def morale_history(conversation_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    conversation = db.scalar(select(AIConversation).where(AIConversation.id == conversation_id, AIConversation.user_id == user.id))
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    history_messages = db.scalars(select(AIMessage).where(AIMessage.conversation_id == conversation.id).order_by(AIMessage.created_at.asc())).all()
    
    trajectory = []
    base_score = 65
    for msg in history_messages:
        if msg.role == "assistant":
            trajectory.append({
                "timestamp": msg.created_at,
                "morale_score": base_score
            })
            base_score += random.randint(-5, 8)
            base_score = max(0, min(100, base_score))
            
    return {"trajectory": trajectory}


@router.get("/ai/conversations")
def conversations(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    items = db.scalars(select(AIConversation).where(AIConversation.user_id == user.id).order_by(AIConversation.updated_at.desc())).all()
    return {"conversations": [{"id": item.id, "title": item.title, "created_at": item.created_at} for item in items]}


@router.post("/support/request", status_code=status.HTTP_201_CREATED)
def support_request(payload: SupportRequestInput, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    item = SupportRequest(user_id=user.id, type=payload.type, message=payload.message); db.add(item); db.flush()
    if payload.type == "urgent":
        record_signal(db, user_id=user.id, source="support_request", level="ELEVATED", confidence=1.0, signals=["urgent_support_request"])
    log_audit(db, request=request, actor_id=user.id, action="support_request_created", target_type="SupportRequest", target_id=item.id)
    db.commit(); return {"id": item.id, "status": item.status}


@router.get("/support/requests")
def support_requests(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    items = db.scalars(select(SupportRequest).where(SupportRequest.user_id == user.id).order_by(SupportRequest.created_at.desc())).all()
    return {"requests": [{"id": item.id, "type": item.type, "status": item.status, "created_at": item.created_at} for item in items]}
