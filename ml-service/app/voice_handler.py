import asyncio
import tempfile
import os
import logging
from concurrent.futures import ThreadPoolExecutor

import edge_tts

logger = logging.getLogger(__name__)

# Ensure bundled ffmpeg binary is discoverable for Whisper audio processing
try:
    import imageio_ffmpeg
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    ffmpeg_dir = os.path.dirname(ffmpeg_exe)
    if ffmpeg_dir not in os.environ.get("PATH", ""):
        os.environ["PATH"] = ffmpeg_dir + os.pathsep + os.environ.get("PATH", "")
        logger.info(f"Configured bundled FFmpeg from {ffmpeg_dir}")
except Exception as e:
    logger.warning(f"Could not configure imageio-ffmpeg: {e}")


class VoiceHandler:
    def __init__(self):
        self._whisper_pipeline = None
        self._executor = ThreadPoolExecutor(max_workers=2)

    def _get_whisper_pipeline(self):
        if self._whisper_pipeline is None:
            try:
                from transformers import pipeline
                logger.info("Initializing HuggingFace Whisper STT pipeline...")
                self._whisper_pipeline = pipeline(
                    "automatic-speech-recognition",
                    model="openai/whisper-tiny",
                    device="cpu"
                )
                logger.info("Whisper STT pipeline loaded successfully.")
            except Exception as e:
                logger.warning(f"Could not load HuggingFace Whisper pipeline: {e}")
                self._whisper_pipeline = None
        return self._whisper_pipeline

    def transcribe_sync(self, audio_bytes: bytes, mime_type: str = "audio/wav") -> str:
        if not audio_bytes or len(audio_bytes) < 32:
            return ""

        mime = mime_type.lower()
        suffix = ".wav"
        if "webm" in mime:
            suffix = ".webm"
        elif "mp4" in mime or "m4a" in mime or "aac" in mime:
            suffix = ".mp4"
        elif "ogg" in mime or "opus" in mime:
            suffix = ".ogg"
        elif "mp3" in mime or "mpeg" in mime:
            suffix = ".mp3"

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
            tmp_file.write(audio_bytes)
            tmp_file_path = tmp_file.name

        transcript = ""
        try:
            # 1. First attempt: HuggingFace Whisper ASR Pipeline
            asr = self._get_whisper_pipeline()
            if asr is not None:
                try:
                    res = asr(tmp_file_path, generate_kwargs={"task": "transcribe"})
                    if isinstance(res, dict) and "text" in res:
                        transcript = res["text"].strip()
                except Exception as wex:
                    logger.warning(f"Whisper pipeline inference error: {wex}")

            # 2. Second attempt: SpeechRecognition Google Web ASR
            if not transcript:
                try:
                    import speech_recognition as sr
                    r = sr.Recognizer()
                    with sr.AudioFile(tmp_file_path) as source:
                        audio_data = r.record(source)
                        transcript = r.recognize_google(audio_data).strip()
                except Exception as srex:
                    logger.debug(f"SpeechRecognition fallback error: {srex}")

        except Exception as e:
            logger.error(f"Voice transcription unexpected error: {e}")
        finally:
            if os.path.exists(tmp_file_path):
                os.remove(tmp_file_path)

        return transcript if transcript else "Voice recording processed. Please review or add notes before saving."

    async def transcribe(self, audio_bytes: bytes, mime_type: str) -> str:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(self._executor, self.transcribe_sync, audio_bytes, mime_type)

    async def synthesize(self, text: str) -> bytes:
        from app.config import settings
        voice = getattr(settings, "tts_voice", "en-US-ChristopherNeural")
        communicate = edge_tts.Communicate(text, voice)
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp_file:
            tmp_file_path = tmp_file.name
            
        try:
            await communicate.save(tmp_file_path)
            with open(tmp_file_path, "rb") as f:
                return f.read()
        finally:
            if os.path.exists(tmp_file_path):
                os.remove(tmp_file_path)

voice_handler = VoiceHandler()
