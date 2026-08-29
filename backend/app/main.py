from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routers import admin, auth, wellbeing
from app.websocket import routes as websocket_routes
from app.core.config import get_settings
from app.database.seed import seed_development_data
from app.database.session import Base, SessionLocal, engine
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.middleware.csrf import CSRFMiddleware


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    if get_settings().environment == "development":
        with SessionLocal() as db:
            seed_development_data(db)
    yield


settings = get_settings()
app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="AI-assisted wellbeing and early-support API. It is not a diagnostic service.",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
)

# Custom Middlewares
app.add_middleware(SecurityHeadersMiddleware, is_production=(settings.environment == "production"))
app.add_middleware(CSRFMiddleware)

# Routers
app.include_router(auth.router)
app.include_router(wellbeing.router)
app.include_router(admin.router)
app.include_router(websocket_routes.router)


@app.get("/health", tags=["Operations"])
def health() -> dict[str, str]:
    return {"status": "ok", "service": "mentalwelfare-api"}


@app.exception_handler(Exception)
async def unhandled_exception(request: Request, exc: Exception) -> JSONResponse:
    # Preserve details in server logs in production; clients get no stack trace.
    return JSONResponse(status_code=500, content={"detail": "An unexpected error occurred"})

