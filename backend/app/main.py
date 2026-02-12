"""FastAPI application entry point"""
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging

from app.config import settings
from app.database import init_db, close_db
from app.middleware.security import SecurityHeadersMiddleware

# Configure logging
logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

from app.api.v1 import auth, dashboard, market_intel, opportunities, crm, proposals, ptw, pwin, ai_assistant, admin, teaming, integrations, documents, company_profile

# Verify AI assistant routes are loaded
try:
    from app.services.ai_service import generate_company_profile_field
    logger.info("generate_company_profile_field imported successfully")
except Exception as e:
    logger.error(f"Failed to import generate_company_profile_field: {e}")
    import traceback
    traceback.print_exc()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    logger.info("Starting PipelinePro application...")
    try:
        await init_db()
        logger.info("Database initialized")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        raise
    
    yield
    
    # Shutdown
    logger.info("Shutting down PipelinePro application...")
    await close_db()
    logger.info("Database connections closed")


# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="All-in-one GovCon SaaS platform",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# Security headers middleware
app.add_middleware(SecurityHeadersMiddleware)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=settings.CORS_ALLOW_METHODS,
    allow_headers=settings.CORS_ALLOW_HEADERS,
)


# Error handlers
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    import traceback
    error_details = traceback.format_exc()
    logger.error(f"Traceback: {error_details}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": f"Internal server error: {str(exc)}",
            "error_type": type(exc).__name__,
        },
    )


# Health check
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "version": settings.APP_VERSION}


# API routes
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["Dashboard"])
app.include_router(market_intel.router, prefix="/api/v1/market-intel", tags=["Market Intelligence"])
app.include_router(opportunities.router, prefix="/api/v1/opportunities", tags=["Opportunities"])
app.include_router(crm.router, prefix="/api/v1/crm", tags=["CRM"])
app.include_router(proposals.router, prefix="/api/v1/proposals", tags=["Proposals"])
app.include_router(ptw.router, prefix="/api/v1/ptw", tags=["Price-to-Win"])
app.include_router(pwin.router, prefix="/api/v1/pwin", tags=["PWin Calculator"])
app.include_router(ai_assistant.router, prefix="/api/v1/ai", tags=["AI Assistant"])
# Debug: Log registered AI routes
logger.info(f"AI Assistant routes registered: {len(ai_assistant.router.routes)} routes")
for route in ai_assistant.router.routes:
    if hasattr(route, 'path') and hasattr(route, 'methods'):
        logger.info(f"  - {list(route.methods)} {route.path}")
app.include_router(admin.router, prefix="/api/v1/admin", tags=["Administration"])
app.include_router(teaming.router, prefix="/api/v1/teaming", tags=["Teaming & Partners"])
app.include_router(integrations.router, prefix="/api/v1/integrations", tags=["Integrations"])
app.include_router(documents.router, prefix="/api/v1", tags=["Documents"])
app.include_router(company_profile.router, prefix="/api/v1", tags=["Company Profile"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
    )


