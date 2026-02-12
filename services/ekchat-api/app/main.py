"""FastAPI entry point for ekchat-api service."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import chats_router, rfp_router


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/api/ekchat/docs",
    redoc_url="/api/ekchat/redoc",
    openapi_url="/api/ekchat/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chats_router, prefix="/api/ekchat/v1", tags=["ekchat"])
app.include_router(rfp_router, prefix="/api/ekchat/v1", tags=["ekchat-rfp"])
