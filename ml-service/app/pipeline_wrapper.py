import sys
import os
import asyncio
import threading
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

# Resolve the pipeline's working directory once at import time
# This avoids the os.chdir() race condition in the ThreadPoolExecutor
_PIPELINE_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..")
)

class PipelineWrapper:
    def __init__(self):
        self._lock = threading.Lock()
        self._loaded = False
        self._loading = False
        self._error = None
        self._pipeline_module = None
        self._executor = ThreadPoolExecutor(max_workers=4)

        # Per-user session trajectories (keyed by user_id)
        self._sessions: Dict[str, list] = {}

    def load_models(self) -> None:
        """Lazy load the pipeline models in a thread-safe manner."""
        if self._loaded:
            return

        with self._lock:
            if self._loaded:
                return

            self._loading = True
            try:
                # Add pipeline directory to sys.path
                if _PIPELINE_DIR not in sys.path:
                    sys.path.insert(0, _PIPELINE_DIR)

                # Set CWD via env so pipeline.py can find outputs/ and rag_db.json
                # without calling os.chdir() in threads
                os.environ.setdefault("PIPELINE_CWD", _PIPELINE_DIR)

                # Switch CWD once at load time (safe here — single thread, under lock)
                original_cwd = os.getcwd()
                os.chdir(_PIPELINE_DIR)

                import azure_job.pipeline as pipeline_module
                self._pipeline_module = pipeline_module

                # Warm up with a benign test call
                _ = self._pipeline_module.run_pipeline(
                    "initializing", trajectory_trend="STABLE", print_logs=False
                )
                os.chdir(original_cwd)

                self._loaded = True
                self._error = None
                logger.info("Models loaded successfully.")
            except Exception as e:
                self._error = str(e)
                logger.error(f"Failed to load models: {e}")
                raise
            finally:
                self._loading = False

    def get_session_trajectory(self, session_id: str) -> str:
        """Returns the trajectory trend for a session based on morale history."""
        history = self._sessions.get(session_id, [])
        if len(history) < 2:
            return "INITIALIZING..."

        recent_scores = [entry.get("morale_score", 50) for entry in history[-3:]]
        if recent_scores[-1] > recent_scores[0] + 5:
            return "IMPROVING"
        elif recent_scores[-1] < recent_scores[0] - 5:
            return "DECLINING"
        return "STABLE"

    async def process(self, text: str, session_id: str, system_context: str = "") -> dict:
        """Run the pipeline asynchronously in a thread pool."""
        if not self._loaded:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(self._executor, self.load_models)

        trajectory = self.get_session_trajectory(session_id)

        # Build enriched input: prepend system_context as a hidden preamble
        # so the 135M model can use profile/assessment data for context
        enriched_text = text
        if system_context:
            enriched_text = f"[System Context]\n{system_context}\n\n[User Message]\n{text}"

        loop = asyncio.get_event_loop()

        def _run():
            # Use _PIPELINE_DIR resolved at import time — no os.chdir() race
            # The pipeline was already warm-started from _PIPELINE_DIR
            return self._pipeline_module.run_pipeline(
                enriched_text, trajectory_trend=trajectory, print_logs=False
            )

        try:
            response, morale_score, mood_str, is_emergency = await loop.run_in_executor(
                self._executor, _run
            )
        except Exception as e:
            logger.error(f"Pipeline execution error: {e}")
            raise

        result = {
            "response": response,
            "morale_score": morale_score,
            "mood": mood_str,
            "is_emergency": is_emergency,
            "rag_source": None,
        }

        # Update per-user session history (bounded to last 20 turns)
        if session_id not in self._sessions:
            self._sessions[session_id] = []
        self._sessions[session_id].append(result)
        if len(self._sessions[session_id]) > 20:
            self._sessions[session_id] = self._sessions[session_id][-20:]

        return result

    async def analyze_text(self, text: str) -> dict:
        """Analyze text mood using only the intent router — no LLM generation."""
        if not self._loaded:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(self._executor, self.load_models)

        loop = asyncio.get_event_loop()

        def _analyze_only():
            # Call only the lightweight analyze_intent function from pipeline.py
            # This avoids running full LLM generation just for mood scoring
            try:
                mood_str, morale_score = self._pipeline_module.analyze_intent(text)
                is_emergency = mood_str == "emergency"
                return mood_str, morale_score, is_emergency
            except AttributeError:
                # Fallback: use full pipeline if analyze_intent not exposed
                resp, morale, mood, emerg = self._pipeline_module.run_pipeline(
                    text, trajectory_trend="STABLE", print_logs=False
                )
                return mood, morale, emerg

        try:
            mood_str, morale_score, is_emergency = await loop.run_in_executor(
                self._executor, _analyze_only
            )
        except Exception as e:
            logger.error(f"analyze_text error: {e}")
            return {
                "wellbeing_signal": "NORMAL",
                "confidence": 0.5,
                "signals": [],
                "morale_score": 50,
                "mood": "triage",
                "requires_human_review": False,
            }

        # Map mood string to wellbeing level
        mood_to_level = {
            "joy": "NORMAL",
            "triage": "ELEVATED",
            "emergency": "CRITICAL",
        }
        wellbeing_level = mood_to_level.get(mood_str, "ELEVATED")

        signals = [mood_str]
        if is_emergency:
            signals.append("emergency")
            wellbeing_level = "CRITICAL"

        confidence = 0.9 if is_emergency else (0.75 if mood_str == "triage" else 0.85)

        return {
            "wellbeing_signal": wellbeing_level,
            "confidence": confidence,
            "signals": signals,
            "morale_score": morale_score,
            "mood": mood_str,
            "requires_human_review": is_emergency,
        }

    def health_check(self) -> dict:
        status = (
            "ok" if self._loaded
            else "loading" if self._loading
            else "error" if self._error
            else "uninitialized"
        )
        return {
            "status": status,
            "error": self._error,
            "models": {
                "router": self._loaded,
                "llm": self._loaded,
                "rag": self._loaded,
            },
        }


pipeline_wrapper = PipelineWrapper()
