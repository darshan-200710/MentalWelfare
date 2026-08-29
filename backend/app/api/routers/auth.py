from datetime import UTC, datetime, timedelta
from hashlib import sha256
import secrets
from typing import Optional, List, Dict, Any
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, status, BackgroundTasks
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import current_user
from app.core.config import get_settings
from app.core.security import create_access_token, create_refresh_token, hash_password, verify_password
from app.database.models import RefreshSession, User, MFAToken
from app.database.session import get_db
from app.schemas import LoginRequest, RefreshRequest, RegisterRequest, TokenResponse, UserResponse
from app.services.audit import log_audit
from app.services.email import get_email_provider, verification_email, password_reset_email
from app.services.mfa import generate_totp_secret, generate_totp_uri, verify_totp, generate_recovery_codes, hash_recovery_code, verify_recovery_code

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# Local schemas
class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class MFASetupResponse(BaseModel):
    secret: str
    uri: str

class MFAVerifySetupRequest(BaseModel):
    code: str

class MFAVerifySetupResponse(BaseModel):
    recovery_codes: List[str]

class MFADisableRequest(BaseModel):
    password: str

class MFAVerifyRequest(BaseModel):
    mfa_token: str
    code: str

class PasswordVerifyRequest(BaseModel):
    password: str

class SessionResponse(BaseModel):
    id: str
    expires_at: datetime
    is_current: bool

def user_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id, 
        email=user.email, 
        name=user.name, 
        role=user.role, 
        onboarding_complete=user.onboarding_complete, 
        mfa_enabled=user.mfa_enabled
    )

def issue_tokens(db: Session, user: User) -> TokenResponse:
    refresh, refresh_hash, refresh_expiry = create_refresh_token(user.id)
    db.add(RefreshSession(user_id=user.id, token_hash=refresh_hash, expires_at=refresh_expiry))
    return TokenResponse(access_token=create_access_token(user.id, user.role), refresh_token=refresh)

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, request: Request, background_tasks: BackgroundTasks, db: Session = Depends(get_db)) -> TokenResponse:
    if db.scalar(select(User).where(User.email == payload.email.lower())):
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    
    user = User(
        email=payload.email.lower(), 
        name=payload.name, 
        password_hash=hash_password(payload.password),
        mfa_enabled=False,
        email_verified=False
    )
    db.add(user)
    db.flush()
    
    log_audit(db, request=request, actor_id=user.id, action="register", target_type="User", target_id=user.id)
    
    # Generate verification token
    raw_token = secrets.token_urlsafe(32)
    user.email_verification_token = sha256(raw_token.encode()).hexdigest()
    user.email_verification_expires = datetime.now(UTC) + timedelta(hours=24)
    
    provider = get_email_provider()
    settings = get_settings()
    subject, html_body = verification_email(user.name or "User", raw_token, settings.base_url)
    
    background_tasks.add_task(provider.send, user.email, subject, html_body)
    
    tokens = issue_tokens(db, user)
    db.commit()
    return tokens


@router.post("/login")
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    now = datetime.now(UTC)
    
    if not user or not user.password_hash or (user.locked_until and user.locked_until.replace(tzinfo=UTC) > now) or not verify_password(payload.password, user.password_hash):
        if user:
            user.failed_login_attempts += 1
            if user.failed_login_attempts >= 5:
                user.locked_until = now + timedelta(minutes=15)
            log_audit(db, request=request, actor_id=user.id, action="failed_login", target_type="User", target_id=user.id)
            db.commit()
        raise HTTPException(status_code=401, detail="Invalid credentials or temporarily locked account")
    
    user.failed_login_attempts = 0
    user.locked_until = None
    
    if user.mfa_enabled:
        # Issue an MFA token and require challenge
        raw_mfa_token = secrets.token_urlsafe(32)
        mfa_token_hash = sha256(raw_mfa_token.encode()).hexdigest()
        
        db.add(MFAToken(user_id=user.id, token_hash=mfa_token_hash))
        log_audit(db, request=request, actor_id=user.id, action="login_mfa_challenge", target_type="User", target_id=user.id)
        db.commit()
        
        return {"mfa_required": True, "mfa_token": raw_mfa_token}

    log_audit(db, request=request, actor_id=user.id, action="login", target_type="User", target_id=user.id)
    tokens = issue_tokens(db, user)
    db.commit()
    return tokens


@router.post("/mfa/verify", response_model=TokenResponse)
def verify_mfa(payload: MFAVerifyRequest, request: Request, db: Session = Depends(get_db)):
    token_hash = sha256(payload.mfa_token.encode()).hexdigest()
    mfa_token = db.scalar(select(MFAToken).where(MFAToken.token_hash == token_hash, MFAToken.used == False))
    
    if not mfa_token:
        raise HTTPException(status_code=401, detail="Invalid or expired MFA token")
        
    # Check expiry (e.g., 5 mins)
    if datetime.now(UTC) - mfa_token.created_at.replace(tzinfo=UTC) > timedelta(minutes=5):
        raise HTTPException(status_code=401, detail="MFA token expired")
        
    user = db.get(User, mfa_token.user_id)
    if not user or not user.mfa_secret:
        raise HTTPException(status_code=401, detail="Invalid user or MFA not enabled")
        
    is_valid_totp = verify_totp(user.mfa_secret, payload.code)
    is_valid_recovery = False
    
    if not is_valid_totp and user.recovery_codes:
        # Try recovery code
        is_valid_recovery, code_idx = verify_recovery_code(payload.code, user.recovery_codes)
        if is_valid_recovery:
            # Remove used recovery code
            new_codes = user.recovery_codes.copy()
            new_codes.pop(code_idx)
            user.recovery_codes = new_codes
    
    if not is_valid_totp and not is_valid_recovery:
        log_audit(db, request=request, actor_id=user.id, action="failed_mfa", target_type="User", target_id=user.id)
        db.commit()
        raise HTTPException(status_code=401, detail="Invalid MFA code")
        
    mfa_token.used = True
    log_audit(db, request=request, actor_id=user.id, action="login", target_type="User", target_id=user.id)
    
    tokens = issue_tokens(db, user)
    db.commit()
    return tokens


@router.post("/mfa/setup", response_model=MFASetupResponse)
def mfa_setup(payload: PasswordVerifyRequest, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid password")
        
    if user.mfa_enabled:
        raise HTTPException(status_code=400, detail="MFA already enabled")
        
    secret = generate_totp_secret()
    user.mfa_secret = secret  # Temporarily store it, not fully enabled until verified
    
    settings = get_settings()
    uri = generate_totp_uri(secret, user.email, settings.mfa_issuer)
    
    db.commit()
    return {"secret": secret, "uri": uri}


@router.post("/mfa/verify-setup", response_model=MFAVerifySetupResponse)
def mfa_verify_setup(payload: MFAVerifySetupRequest, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if user.mfa_enabled:
        raise HTTPException(status_code=400, detail="MFA already enabled")
        
    if not user.mfa_secret:
        raise HTTPException(status_code=400, detail="MFA setup not initiated")
        
    if not verify_totp(user.mfa_secret, payload.code):
        raise HTTPException(status_code=400, detail="Invalid code")
        
    user.mfa_enabled = True
    plain_codes = generate_recovery_codes(8)
    user.recovery_codes = [hash_recovery_code(c) for c in plain_codes]
    
    log_audit(db, request=request, actor_id=user.id, action="mfa_enabled", target_type="User", target_id=user.id)
    db.commit()
    
    return {"recovery_codes": plain_codes}


@router.post("/mfa/disable", status_code=status.HTTP_204_NO_CONTENT)
def mfa_disable(payload: MFADisableRequest, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid password")
        
    user.mfa_enabled = False
    user.mfa_secret = None
    user.recovery_codes = None
    
    log_audit(db, request=request, actor_id=user.id, action="mfa_disabled", target_type="User", target_id=user.id)
    db.commit()


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)) -> TokenResponse:
    refresh_token = payload.refresh_token
    settings = get_settings()
    try:
        decoded = jwt.decode(refresh_token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError as error:
        raise HTTPException(status_code=401, detail="Invalid refresh token") from error
        
    if decoded.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
        
    session = db.scalar(select(RefreshSession).where(RefreshSession.token_hash == sha256(refresh_token.encode()).hexdigest()))
    
    if not session or session.revoked_at or session.expires_at.replace(tzinfo=UTC) < datetime.now(UTC):
        raise HTTPException(status_code=401, detail="Refresh session is unavailable")
        
    user = db.get(User, session.user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Refresh session is unavailable")
        
    session.revoked_at = datetime.now(UTC)  # rotation
    tokens = issue_tokens(db, user)
    db.commit()
    return tokens


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(payload: RefreshRequest, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)) -> None:
    token_hash = sha256(payload.refresh_token.encode()).hexdigest()
    session = db.scalar(select(RefreshSession).where(RefreshSession.token_hash == token_hash, RefreshSession.user_id == user.id))
    if session:
        session.revoked_at = datetime.now(UTC)
    log_audit(db, request=request, actor_id=user.id, action="logout")
    db.commit()


@router.get("/me", response_model=UserResponse)
def me(user: User = Depends(current_user)) -> UserResponse:
    return user_response(user)


@router.post("/forgot-password", status_code=status.HTTP_202_ACCEPTED)
def forgot_password(payload: ForgotPasswordRequest, background_tasks: BackgroundTasks, request: Request, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if user:
        raw_token = secrets.token_urlsafe(32)
        user.password_reset_token = sha256(raw_token.encode()).hexdigest()
        user.password_reset_expires = datetime.now(UTC) + timedelta(hours=1)
        
        provider = get_email_provider()
        settings = get_settings()
        subject, html_body = password_reset_email(user.name or "User", raw_token, settings.base_url)
        
        background_tasks.add_task(provider.send, user.email, subject, html_body)
        log_audit(db, request=request, actor_id=user.id, action="password_reset_requested", target_type="User", target_id=user.id)
        db.commit()
        
    return {"message": "If an account exists, reset instructions will be sent."}


@router.post("/reset-password", status_code=status.HTTP_200_OK)
def reset_password(payload: ResetPasswordRequest, request: Request, db: Session = Depends(get_db)):
    token_hash = sha256(payload.token.encode()).hexdigest()
    user = db.scalar(select(User).where(User.password_reset_token == token_hash))
    
    if not user or not user.password_reset_expires or user.password_reset_expires.replace(tzinfo=UTC) < datetime.now(UTC):
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
        
    user.password_hash = hash_password(payload.new_password)
    user.password_reset_token = None
    user.password_reset_expires = None
    
    # Revoke all existing sessions
    db.query(RefreshSession).filter(RefreshSession.user_id == user.id, RefreshSession.revoked_at == None).update({"revoked_at": datetime.now(UTC)})
    
    log_audit(db, request=request, actor_id=user.id, action="password_reset_completed", target_type="User", target_id=user.id)
    db.commit()
    
    return {"message": "Password updated successfully"}


@router.post("/send-verification", status_code=status.HTTP_202_ACCEPTED)
def send_verification(background_tasks: BackgroundTasks, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if user.email_verified:
        return {"message": "Email already verified"}
        
    raw_token = secrets.token_urlsafe(32)
    user.email_verification_token = sha256(raw_token.encode()).hexdigest()
    user.email_verification_expires = datetime.now(UTC) + timedelta(hours=24)
    
    provider = get_email_provider()
    settings = get_settings()
    subject, html_body = verification_email(user.name or "User", raw_token, settings.base_url)
    
    background_tasks.add_task(provider.send, user.email, subject, html_body)
    db.commit()
    
    return {"message": "Verification email sent"}


@router.get("/verify-email", status_code=status.HTTP_200_OK)
def verify_email(token: str, request: Request, db: Session = Depends(get_db)):
    token_hash = sha256(token.encode()).hexdigest()
    user = db.scalar(select(User).where(User.email_verification_token == token_hash))
    
    if not user or not user.email_verification_expires or user.email_verification_expires.replace(tzinfo=UTC) < datetime.now(UTC):
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")
        
    user.email_verified = True
    user.email_verification_token = None
    user.email_verification_expires = None
    
    log_audit(db, request=request, actor_id=user.id, action="email_verified", target_type="User", target_id=user.id)
    db.commit()
    
    return {"message": "Email verified successfully"}


@router.get("/sessions", response_model=List[SessionResponse])
def get_sessions(request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    sessions = db.query(RefreshSession).filter(
        RefreshSession.user_id == user.id,
        RefreshSession.revoked_at == None,
        RefreshSession.expires_at > datetime.now(UTC)
    ).all()
    
    # Try to identify current session if authorization header has refresh token
    # (Typically this endpoint would be accessed using access token, so identifying current refresh session is tricky unless refresh token is passed or we look at access token claims)
    # Since we can't reliably know the current refresh session from just the access token, we set is_current to False or try to match.
    
    result = []
    for s in sessions:
        result.append({
            "id": s.id,
            "expires_at": s.expires_at,
            "is_current": False  # Simplification
        })
        
    return result


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_session(session_id: str, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    session = db.scalar(select(RefreshSession).where(RefreshSession.id == session_id, RefreshSession.user_id == user.id))
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    session.revoked_at = datetime.now(UTC)
    log_audit(db, request=request, actor_id=user.id, action="session_revoked", target_type="Session", target_id=session.id)
    db.commit()


@router.get("/google", status_code=status.HTTP_501_NOT_IMPLEMENTED)
def google_oidc() -> dict[str, str]:
    raise HTTPException(status_code=501, detail="Google OIDC requires configured client credentials")
