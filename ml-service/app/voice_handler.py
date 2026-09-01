import asyncio
import tempfile
import os
import sys
import logging
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# FFmpeg path resolution — handles both dev and PyInstaller EXE environments
# ---------------------------------------------------------------------------
def _configure_ffmpeg():
    """Ensure bundled or system ffmpeg is on PATH before any audio processing."""
    # 1. If launcher.py already set FFMPEG_BINARY, trust it
    env_ffmpeg = os.environ.get("FFMPEG_BINARY", "")
    if env_ffmpeg and os.path.isfile(env_ffmpeg):
        ffmpeg_dir = os.path.dirname(env_ffmpeg)
        if ffmpeg_dir not in os.environ.get("PATH", ""):
            os.environ["PATH"] = ffmpeg_dir + os.pathsep + os.environ.get("PATH", "")
        logger.info(f"[ffmpeg] Using FFMPEG_BINARY env: {env_ffmpeg}")
        return

    # 2. PyInstaller _MEIPASS: look for ffmpeg.exe next to or inside the bundle
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        meipass = sys._MEIPASS
        candidates = [
            os.path.join(meipass, "ffmpeg.exe"),
            os.path.join(meipass, "ml-service", "ffmpeg.exe"),
        ]
        for p in candidates:
            if os.path.isfile(p):
                d = os.path.dirname(p)
                if d not in os.environ.get("PATH", ""):
                    os.environ["PATH"] = d + os.pathsep + os.environ.get("PATH", "")
                os.environ["FFMPEG_BINARY"] = p
                logger.info(f"[ffmpeg] Resolved from _MEIPASS: {p}")
                return

    # 3. Repository-bundled binary for local development
    bundled_ffmpeg = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "ffmpeg.exe")
    )
    if os.path.isfile(bundled_ffmpeg):
        ffmpeg_dir = os.path.dirname(bundled_ffmpeg)
        if ffmpeg_dir not in os.environ.get("PATH", ""):
            os.environ["PATH"] = ffmpeg_dir + os.pathsep + os.environ.get("PATH", "")
        os.environ["FFMPEG_BINARY"] = bundled_ffmpeg
        logger.info(f"[ffmpeg] Using repository binary: {bundled_ffmpeg}")
        return

    # 4. imageio_ffmpeg bundled binary (works in dev / pip environment)
    try:
        import imageio_ffmpeg
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        ffmpeg_dir = os.path.dirname(ffmpeg_exe)
        if ffmpeg_dir not in os.environ.get("PATH", ""):
            os.environ["PATH"] = ffmpeg_dir + os.pathsep + os.environ.get("PATH", "")
        os.environ.setdefault("FFMPEG_BINARY", ffmpeg_exe)
        logger.info(f"[ffmpeg] Using imageio_ffmpeg: {ffmpeg_exe}")
        return
    except Exception as e:
        logger.warning(f"[ffmpeg] imageio_ffmpeg not available: {e}")

    logger.warning("[ffmpeg] ffmpeg not configured — audio conversion may fail")

_configure_ffmpeg()

# ---------------------------------------------------------------------------
# edge_tts lazy import — avoid crash at module load if edge_tts unavailable
# ---------------------------------------------------------------------------
try:
    import edge_tts as _edge_tts
    _EDGE_TTS_AVAILABLE = True
except ImportError:
    _EDGE_TTS_AVAILABLE = False
    logger.warning("[tts] edge_tts not available — will use pyttsx3 fallback")


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

        mime = mime_type.lower().split(";")[0].strip()
        suffix = ".wav"
        if "webm" in mime:
            suffix = ".webm"
        elif "mp4" in mime or "m4a" in mime or "aac" in mime:
            suffix = ".mp4"
        elif "ogg" in mime or "opus" in mime:
            suffix = ".ogg"
        elif "mp3" in mime or "mpeg" in mime:
            suffix = ".mp3"

        tmp_file_path = None
        wav_path = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
                tmp_file.write(audio_bytes)
                tmp_file_path = tmp_file.name

            # Convert to WAV using ffmpeg for reliable Whisper input
            ffmpeg_bin = os.environ.get("FFMPEG_BINARY", "ffmpeg")
            wav_path = tmp_file_path.replace(suffix, "_converted.wav")
            try:
                import subprocess
                result = subprocess.run(
                    [ffmpeg_bin, "-y", "-i", tmp_file_path, "-ar", "16000", "-ac", "1", wav_path],
                    capture_output=True, timeout=30
                )
                input_path = wav_path if result.returncode == 0 and os.path.exists(wav_path) else tmp_file_path
            except Exception as conv_err:
                logger.warning(f"[stt] ffmpeg conversion failed: {conv_err}")
                input_path = tmp_file_path

            transcript = ""

            # 1. HuggingFace Whisper ASR Pipeline
            asr = self._get_whisper_pipeline()
            if asr is not None:
                try:
                    res = asr(input_path, generate_kwargs={"task": "transcribe"})
                    if isinstance(res, dict) and "text" in res:
                        transcript = res["text"].strip()
                except Exception as wex:
                    logger.warning(f"Whisper pipeline inference error: {wex}")

            # 2. SpeechRecognition Google Web ASR (requires internet)
            if not transcript:
                try:
                    import speech_recognition as sr
                    r = sr.Recognizer()
                    with sr.AudioFile(input_path) as source:
                        audio_data = r.record(source)
                        transcript = r.recognize_google(audio_data).strip()
                except Exception as srex:
                    logger.debug(f"SpeechRecognition fallback error: {srex}")

            return transcript

        except Exception as e:
            logger.error(f"Voice transcription unexpected error: {e}")
            return ""
        finally:
            for p in [tmp_file_path, wav_path]:
                if p and os.path.exists(p):
                    try:
                        os.remove(p)
                    except Exception:
                        pass

    async def transcribe(self, audio_bytes: bytes, mime_type: str) -> str:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(self._executor, self.transcribe_sync, audio_bytes, mime_type)

    def synthesize_sync(self, text: str) -> bytes:
        """Synchronous TTS: edge_tts (online) → pyttsx3 (offline fallback)."""
        from app.config import settings
        voice = getattr(settings, "tts_voice", "en-US-ChristopherNeural")

        # Attempt 1: edge_tts (high quality, requires network)
        if _EDGE_TTS_AVAILABLE:
            tmp_file_path = None
            try:
                import asyncio as _asyncio

                async def _run_edge():
                    communicate = _edge_tts.Communicate(text, voice)
                    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as f:
                        path = f.name
                    await communicate.save(path)
                    return path

                # Run edge_tts in a new event loop to avoid conflicts
                loop = _asyncio.new_event_loop()
                try:
                    tmp_file_path = loop.run_until_complete(_run_edge())
                finally:
                    loop.close()

                with open(tmp_file_path, "rb") as f:
                    return f.read()
            except Exception as e:
                logger.warning(f"[tts] edge_tts failed: {e} — trying pyttsx3 fallback")
            finally:
                if tmp_file_path and os.path.exists(tmp_file_path):
                    try:
                        os.remove(tmp_file_path)
                    except Exception:
                        pass

        # Attempt 2: pyttsx3 (offline, lower quality)
        try:
            import pyttsx3
            import io
            import wave
            import struct

            engine = pyttsx3.init()
            engine.setProperty("rate", 165)
            tmp_path = tempfile.mktemp(suffix=".wav")
            engine.save_to_file(text, tmp_path)
            engine.runAndWait()
            if os.path.exists(tmp_path):
                with open(tmp_path, "rb") as f:
                    data = f.read()
                os.remove(tmp_path)
                return data
        except Exception as e2:
            logger.error(f"[tts] pyttsx3 fallback also failed: {e2}")

        # Return empty bytes — caller will handle 503
        return b""

    async def synthesize(self, text: str) -> bytes:
        loop = asyncio.get_event_loop()
        data = await loop.run_in_executor(self._executor, self.synthesize_sync, text)
        if not data:
            raise RuntimeError("All TTS providers failed")
        return data


voice_handler = VoiceHandler()
