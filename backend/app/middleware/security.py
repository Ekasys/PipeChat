"""Security middleware for compliance"""
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response as StarletteResponse


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers for compliance"""
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Security headers for FedRAMP/NIST/CMMC compliance
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        # Relax CSP for interactive API docs which load assets from CDN
        path = request.url.path
        if path.startswith("/api/docs") or path.startswith("/api/redoc"):
            csp_directives = [
                "default-src 'self'",
                "img-src 'self' data: https://cdn.jsdelivr.net https://fastapi.tiangolo.com",
                "script-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'",
                "script-src-elem 'self' https://cdn.jsdelivr.net",
                "style-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'",
                "style-src-elem 'self' https://cdn.jsdelivr.net",
                "font-src 'self' data: https://cdn.jsdelivr.net",
            ]
            response.headers["Content-Security-Policy"] = "; ".join(csp_directives)
        else:
            response.headers["Content-Security-Policy"] = "default-src 'self'"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        
        return response

