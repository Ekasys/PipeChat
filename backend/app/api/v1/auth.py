"""Authentication endpoints"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    RefreshTokenRequest,
    RefreshTokenResponse,
    MFASetupRequest,
    MFASetupResponse,
    MFAVerifyRequest,
    SSORequest,
)
from app.services.auth_service import (
    authenticate_user,
    refresh_access_token,
    setup_mfa,
    enable_mfa,
    disable_mfa,
)
from app.dependencies import get_current_user_dependency
from app.integrations.sso import authenticate_azure_ad, authenticate_okta, authenticate_google
from app.models.user import User
from app.config import settings

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
async def login(
    request: LoginRequest,
    http_request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Login with username/password"""
    ip_address = http_request.client.host if http_request.client else None
    user_agent = http_request.headers.get("user-agent")
    
    user, access_token, refresh_token = await authenticate_user(
        db=db,
        username=request.username,
        password=request.password,
        mfa_token=request.mfa_token,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    
    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user={
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "role": user.role,
            "mfa_enabled": user.mfa_enabled,
        },
    )


@router.post("/refresh", response_model=RefreshTokenResponse)
async def refresh(
    request: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
):
    """Refresh access token"""
    access_token = await refresh_access_token(db=db, refresh_token=request.refresh_token)
    
    return RefreshTokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/logout")
async def logout(
    user: User = Depends(get_current_user_dependency),
    db: AsyncSession = Depends(get_db),
):
    """Logout (client should discard tokens)"""
    # In a production system, you might want to blacklist tokens here
    # For now, we'll just return success
    return {"message": "Logged out successfully"}


@router.post("/mfa/setup", response_model=MFASetupResponse)
async def setup_mfa_endpoint(
    request: MFASetupRequest,
    user: User = Depends(get_current_user_dependency),
    db: AsyncSession = Depends(get_db),
):
    """Set up MFA for the current user"""
    secret, qr_code_uri = await setup_mfa(
        db=db,
        user=user,
        password=request.password,
    )
    
    return MFASetupResponse(
        secret=secret,
        qr_code_uri=qr_code_uri,
    )


@router.post("/mfa/verify")
async def verify_mfa_endpoint(
    request: MFAVerifyRequest,
    user: User = Depends(get_current_user_dependency),
    db: AsyncSession = Depends(get_db),
):
    """Verify and enable MFA"""
    await enable_mfa(
        db=db,
        user=user,
        token=request.token,
    )
    
    return {"message": "MFA enabled successfully"}


@router.post("/mfa/disable")
async def disable_mfa_endpoint(
    request: MFASetupRequest,  # Reuse for password
    user: User = Depends(get_current_user_dependency),
    db: AsyncSession = Depends(get_db),
):
    """Disable MFA for the current user"""
    await disable_mfa(
        db=db,
        user=user,
        password=request.password,
    )
    
    return {"message": "MFA disabled successfully"}


@router.post("/sso/{provider}")
async def sso_login(
    provider: str,
    request: SSORequest,
    http_request: Request,
    db: AsyncSession = Depends(get_db),
):
    """SSO login (Azure AD, Okta, Google)"""
    ip_address = http_request.client.host if http_request.client else None
    user_agent = http_request.headers.get("user-agent")
    
    # Route to appropriate SSO provider
    if provider == "azure_ad":
        sso_data = await authenticate_azure_ad(request.code, request.state)
    elif provider == "okta":
        sso_data = await authenticate_okta(request.code, request.state)
    elif provider == "google":
        sso_data = await authenticate_google(request.code, request.state)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown SSO provider: {provider}",
        )
    
    # TODO: Create or update user from SSO data
    # TODO: Generate tokens and return
    
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="SSO login not yet fully implemented",
    )
