import sys
import os
import asyncio
import threading
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, Any, Tuple, Optional

logger = logging.getLogger(__name__)

class PipelineWrapper:
    def __init__(self):
        self._lock = threading.Lock()
        self._loaded = False
        self._loading = False
        self._error = None
        self._pipeline_module = None
        self._executor = ThreadPoolExecutor(max_workers=4)
        
        # Session trajectories
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
                # Add parent directory to sys.path to import azure_job
                parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
                if parent_dir not in sys.path:
                    sys.path.insert(0, parent_dir)
                
                # Import pipeline module
                import azure_job.pipeline as pipeline_module
                self._pipeline_module = pipeline_module
                
                # Warm up models or trigger any necessary initializations by running a dummy input
                # Assuming run_pipeline lazy-loads or initializes on first run.
                # If pipeline.py has an explicit init method, call it here.
                _ = self._pipeline_module.run_pipeline("test", trajectory_trend="STABLE", print_logs=False)
                
                self._loaded = True
                self._error = None
                logger.info("Models loaded successfully.")
            except Exception as e:
                self._error = str(e)
                logger.error(f"Failed to load models: {e}")
                raise e
            finally:
                self._loading = False

    def get_session_trajectory(self, session_id: str) -> str:
        """Returns the trajectory trend for a session based on history."""
        history = self._sessions.get(session_id, [])
        if len(history) < 2:
            return "INITIALIZING..."
        
        # Simple heuristic for demonstration purposes
        recent_scores = [entry.get('morale_score', 50) for entry in history[-3:]]
        if recent_scores[-1] > recent_scores[0] + 5:
            return "IMPROVING"
        elif recent_scores[-1] < recent_scores[0] - 5:
            return "DECLINING"
        return "STABLE"

    async def process(self, text: str, session_id: str) -> dict:
        """Run the pipeline asynchronously in a thread pool."""
        if not self._loaded:
            # Attempt to load synchronously if not loaded
            # Real production code might prefer async loading block
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(self._executor, self.load_models)
            
        trajectory = self.get_session_trajectory(session_id)
        
        loop = asyncio.get_event_loop()
        
        def _run():
            # Ensure we run from a directory where outputs/ models exist if pipeline.py depends on cwd
            # For robustness, we might need to change working directory temporarily
            original_cwd = os.getcwd()
            try:
                parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
                os.chdir(parent_dir)
                return self._pipeline_module.run_pipeline(text, trajectory_trend=trajectory, print_logs=False)
            finally:
                os.chdir(original_cwd)
                
        try:
            response, morale_score, mood_str, is_emergency = await loop.run_in_executor(self._executor, _run)
        except Exception as e:
            logger.error(f"Pipeline execution error: {e}")
            raise e

        result = {
            "response": response,
            "morale_score": morale_score,
            "mood": mood_str,
            "is_emergency": is_emergency,
            "rag_source": None # Extend pipeline if RAG source needs to be extracted
        }
        
        # Update history
        if session_id not in self._sessions:
            self._sessions[session_id] = []
        self._sessions[session_id].append(result)
        
        return result
        
    async def analyze_text(self, text: str) -> dict:
        """Analyze text mood without full response generation."""
        # For this to be fully independent, pipeline.py needs a separate function.
        # Since it's not specified, we'll run the full pipeline and extract signals.
        result = await self.process(text, session_id="analysis_only")
        
        confidence = 0.85 # Placeholder
        wellbeing_signal = result['mood']
        signals = [result['mood']]
        if result['is_emergency']:
            signals.append("emergency")
            
        return {
            "wellbeing_signal": wellbeing_signal,
            "confidence": confidence,
            "signals": signals,
            "morale_score": result['morale_score'],
            "mood": result['mood'],
            "requires_human_review": result['is_emergency']
        }

    def health_check(self) -> dict:
        status = "ok" if self._loaded else ("loading" if self._loading else "error" if self._error else "uninitialized")
        return {
            "status": status,
            "error": self._error,
            "models": {
                "router": self._loaded,
                "llm": self._loaded,
                "rag": self._loaded
            }
        }

pipeline_wrapper = PipelineWrapper()
