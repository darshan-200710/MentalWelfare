import time
from collections import defaultdict
from typing import Callable, Any, Awaitable

from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

# Fallback in-memory store: IP -> list of timestamps
_in_memory_store: dict[str, list[float]] = defaultdict(list)

class RateLimiterMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, key_func: Callable[[Request], str], max_requests: int, window_seconds: int):
        super().__init__(app)
        self.key_func = key_func
        self.max_requests = max_requests
        self.window_seconds = window_seconds

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        try:
            key = self.key_func(request)
        except Exception:
            key = request.client.host if request.client else "unknown"

        now = time.time()
        
        # Clean up old timestamps
        history = _in_memory_store[key]
        history = [ts for ts in history if now - ts < self.window_seconds]
        
        if len(history) >= self.max_requests:
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests, please try again later."}
            )
            
        history.append(now)
        _in_memory_store[key] = history

        response = await call_next(request)
        return response

def get_client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"

def get_user_id_or_ip(request: Request) -> str:
    # Attempt to extract user context if available, fallback to IP
    if hasattr(request.state, "user") and request.state.user:
        return str(request.state.user.id)
    return get_client_ip(request)

# Note: In a real FastAPI app you would typically add these middlewares via app.add_middleware
# However, for route-specific limiting, dependencies are often better. 
# Here we define callable dependencies.

class RateLimitDependency:
    def __init__(self, key_func: Callable[[Request], str], max_requests: int, window_seconds: int):
        self.key_func = key_func
        self.max_requests = max_requests
        self.window_seconds = window_seconds

    async def __call__(self, request: Request):
        try:
            key = self.key_func(request)
        except Exception:
            key = request.client.host if request.client else "unknown"

        now = time.time()
        history = _in_memory_store[key]
        history = [ts for ts in history if now - ts < self.window_seconds]
        
        if len(history) >= self.max_requests:
            raise HTTPException(status_code=429, detail="Rate limit exceeded")
            
        history.append(now)
        _in_memory_store[key] = history

login_limiter = RateLimitDependency(key_func=get_client_ip, max_requests=5, window_seconds=15 * 60)
api_limiter = RateLimitDependency(key_func=get_user_id_or_ip, max_requests=60, window_seconds=60)
ai_chat_limiter = RateLimitDependency(key_func=get_user_id_or_ip, max_requests=20, window_seconds=3600)
voice_limiter = RateLimitDependency(key_func=get_user_id_or_ip, max_requests=5, window_seconds=3600)
