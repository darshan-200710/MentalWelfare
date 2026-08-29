import os
import torch
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_router_path: str = "outputs/transformer_router_final"
    model_llm_path: str = "outputs/model_ultimate_context"
    rag_db_path: str = "rag_db.json"
    device: str = "cuda" if torch.cuda.is_available() else "cpu"
    host: str = "0.0.0.0"
    port: int = 8001
    cors_origins: str = "http://localhost:3000,http://localhost:8000"
    whisper_model: str = "base.en"
    tts_voice: str = "en-US-ChristopherNeural"
    max_new_tokens: int = 150
    rag_threshold: float = 0.40

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

settings = Settings()
