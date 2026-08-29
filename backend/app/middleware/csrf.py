import hmac
import secrets
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from app.core.config import get_settings

class CSRFMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self.secret = get_settings().csrf_secret.encode("utf-8")
        self.exempt_paths = [
            "/api/auth/login",
            "/api/auth/register",
        ]
        self.exempt_prefixes = [
            "/api/ml/",
        ]

    def _generate_token(self) -> str:
        return secrets.token_urlsafe(32)

    def _validate_token(self, token: str, expected_token: str) -> bool:
        if not token or not expected_token:
            return False
        return hmac.compare_digest(token, expected_token)

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        path = request.url.path

        # Check exemptions
        is_exempt = path in self.exempt_paths or any(path.startswith(prefix) for prefix in self.exempt_prefixes)

        # CSRF validation on mutating requests
        if request.method in ["POST", "PUT", "DELETE", "PATCH"] and not is_exempt:
            csrf_cookie = request.cookies.get("csrf_token")
            csrf_header = request.headers.get("X-CSRF-Token")

            if not csrf_cookie or not csrf_header or not self._validate_token(csrf_header, csrf_cookie):
                return Response(
                    content='{"detail": "CSRF token missing or invalid"}',
                    status_code=403,
                    media_type="application/json"
                )

        response = await call_next(request)

        # On GET requests (and occasionally others depending on logic), set CSRF cookie if missing
        if request.method == "GET" and "csrf_token" not in request.cookies:
            token = self._generate_token()
            response.set_cookie(
                key="csrf_token",
                value=token,
                httponly=False,  # Must be readable by JS to send in X-CSRF-Token header
                samesite="lax",
                secure=get_settings().environment == "production",
            )

        return response
