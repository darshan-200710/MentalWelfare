from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)
    name: str | None = Field(default=None, max_length=160)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=32, max_length=4096)


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    name: str | None
    role: str
    onboarding_complete: bool
    mfa_enabled: bool


class AssessmentAnswerInput(BaseModel):
    question_id: str
    value: str = Field(min_length=1, max_length=256)


class AssessmentSubmitRequest(BaseModel):
    answers: list[AssessmentAnswerInput] = Field(min_length=1, max_length=20)


class JournalRequest(BaseModel):
    content: str = Field(min_length=1, max_length=10_000)
    mood: Literal["great", "good", "okay", "low", "rough"] | None = None
    status: Literal["DRAFT", "SUBMITTED"] = "SUBMITTED"


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4_000)
    conversation_id: str | None = None


class SupportRequestInput(BaseModel):
    type: Literal["general", "counselling", "urgent", "peer"]
    message: str = Field(min_length=1, max_length=4_000)


class AlertUpdateRequest(BaseModel):
    status: Literal["OPEN", "ACKNOWLEDGED", "IN_REVIEW", "RESOLVED"]
    assigned_to: str | None = None


class UserUpdateRequest(BaseModel):
    name: str | None = Field(default=None, max_length=160)
    unit: str | None = Field(default=None, max_length=160)


class ConsentRequest(BaseModel):
    purpose: Literal["assessment", "journal_processing", "voice_processing", "ai_processing"]
    status: Literal["GRANTED", "WITHDRAWN"]
    version: str = Field(min_length=1, max_length=24)

# User Management
class CreateUserRequest(BaseModel):
    email: EmailStr
    name: str
    role: str
    unit: str
    service_number: str

class AdminUpdateUserRequest(BaseModel):
    name: str | None = None
    role: str | None = None
    unit: str | None = None
    status: str | None = None

class BulkImportResult(BaseModel):
    created: int
    errors: list[dict]
    total: int

# Resource Management  
class ResourceRequest(BaseModel):
    title: str
    summary: str
    category: str
    body: str

class ResourceResponse(BaseModel):
    id: str
    title: str
    summary: str
    category: str
    body: str
    active: bool

# Emergency Contact Management
class EmergencyContactRequest(BaseModel):
    label: str
    description: str
    contact: str

class EmergencyContactResponse(BaseModel):
    id: str
    label: str
    description: str
    contact: str
    active: bool

# Assessment Question Management
class AssessmentQuestionRequest(BaseModel):
    question_text: str
    question_type: str
    options: list[str] | None = None
    scoring_metadata: dict | None = None
    sort_order: int
