import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List

from app.config import settings
from app.pipeline_wrapper import pipeline_wrapper
from app.voice_handler import voice_handler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Pre-load models asynchronously
    import asyncio
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, pipeline_wrapper.load_models)
    yield
    # Cleanup code here if necessary

app = FastAPI(title="MentalWelfare ML Service", lifespan=lifespan)

origins = settings.cors_origins.split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str
    session_id: str

class ChatResponse(BaseModel):
    response: str
    morale_score: int
    mood: str
    is_emergency: bool
    rag_source: Optional[str] = None

class AnalyzeRequest(BaseModel):
    text: str

class AnalyzeResponse(BaseModel):
    wellbeing_signal: str
    confidence: float
    signals: List[str]
    morale_score: int
    mood: str
    requires_human_review: bool

class VoiceSynthesizeRequest(BaseModel):
    text: str

@app.post("/api/ml/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    try:
        result = await pipeline_wrapper.process(request.message, request.session_id)
        return ChatResponse(**result)
    except Exception as e:
        logger.error(f"Error in chat endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ml/analyze-journal", response_model=AnalyzeResponse)
async def analyze_journal_endpoint(request: AnalyzeRequest):
    try:
        result = await pipeline_wrapper.analyze_text(request.text)
        return AnalyzeResponse(**result)
    except Exception as e:
        logger.error(f"Error in analyze-journal endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ml/voice/transcribe")
async def transcribe_endpoint(file: UploadFile = File(...)):
    try:
        audio_bytes = await file.read()
        transcript = await voice_handler.transcribe(audio_bytes, file.content_type or "audio/wav")
        # Analyze transcript
        analysis = await pipeline_wrapper.analyze_text(transcript)
        return {
            "transcript": transcript,
            "analysis": {
                "morale_score": analysis["morale_score"],
                "mood": analysis["mood"],
                "is_emergency": analysis["requires_human_review"]
            }
        }
    except Exception as e:
        logger.error(f"Error in transcribe endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ml/voice/synthesize")
async def synthesize_endpoint(request: VoiceSynthesizeRequest):
    try:
        audio_bytes = await voice_handler.synthesize(request.text)
        return Response(content=audio_bytes, media_type="audio/mpeg")
    except Exception as e:
        logger.error(f"Error in synthesize endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/ml/health")
async def health_check():
    health = pipeline_wrapper.health_check()
    # Add whisper health (it loads lazily, so we just return if it's initialized)
    health["models"]["whisper"] = voice_handler._whisper_model is not None
    return health
