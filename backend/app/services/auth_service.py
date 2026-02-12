"""Authentication service"""
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status

from app.models.user import User
from app.models.tenant import Tenant
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    verify_token,
    generate_mfa_secret,
    generate_mfa_qr_code,
    verify_mfa_token,
)
from app.core.audit import log_audit_event
from app.config import settings


async def authenticate_user(
    db: AsyncSession,
    username: str,
    password: str,
    mfa_token: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> tuple[User, str, str]:
    """Authenticate a user and return user, access token, and refresh token"""
    # Find user by username or email
    result = await db.execute(
        select(User).where(
            (User.username == username) | (User.email == username)
        )
    )
    user = result.scalar_one_or_none()
    
    if not user:
        await log_audit_event(
            db=db,
            tenant_id="",  # Unknown tenant
            user_id="",
            action="login_failed",
            resource_type="user",
            details={"username": username, "reason": "user_not_found"},
            ip_address=ip_address,
            user_agent=user_agent,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    
    # Check if user is active
    if not user.is_active:
        await log_audit_event(
            db=db,
            tenant_id=user.tenant_id,
            user_id=user.id,
            action="login_failed",
            resource_type="user",
            details={"username": username, "reason": "inactive_user"},
            ip_address=ip_address,
            user_agent=user_agent,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive",
        )
    
    # Verify password
    if not verify_password(password, user.hashed_password):
        await log_audit_event(
            db=db,
            tenant_id=user.tenant_id,
            user_id=user.id,
            action="login_failed",
            resource_type="user",
            details={"username": username, "reason": "invalid_password"},
            ip_address=ip_address,
            user_agent=user_agent,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    
    # Verify MFA if enabled
    if user.mfa_enabled:
        if not mfa_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="MFA token required",
            )
        
        if not user.mfa_secret:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="MFA enabled but secret not configured",
            )
        
        if not verify_mfa_token(user.mfa_secret, mfa_token):
            await log_audit_event(
                db=db,
                tenant_id=user.tenant_id,
                user_id=user.id,
                action="login_failed",
                resource_type="user",
                details={"username": username, "reason": "invalid_mfa_token"},
                ip_address=ip_address,
                user_agent=user_agent,
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid MFA token",
            )
    
    # Update last login
    user.last_login = datetime.utcnow()
    await db.commit()
    
    # Create tokens
    token_data = {
        "sub": user.id,
        "tenant_id": user.tenant_id,
        "email": user.email,
        "role": user.role,
    }
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)
    
    # Log successful login
    await log_audit_event(
        db=db,
        tenant_id=user.tenant_id,
        user_id=user.id,
        action="login",
        resource_type="user",
        details={"username": username},
        ip_address=ip_address,
        user_agent=user_agent,
    )
    
    return user, access_token, refresh_token


async def refresh_access_token(
    db: AsyncSession,
    refresh_token: str,
) -> str:
    """Refresh an access token using a refresh token"""
    payload = verify_token(refresh_token)
    
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )
    
    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )
    
    user_id = payload.get("sub")
    tenant_id = payload.get("tenant_id")
    
    # Verify user still exists and is active
    result = await db.execute(
        select(User).where(
            User.id == user_id,
            User.tenant_id == tenant_id,
            User.is_active == True
        )
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    
    # Create new access token
    token_data = {
        "sub": user.id,
        "tenant_id": user.tenant_id,
        "email": user.email,
        "role": user.role,
    }
    access_token = create_access_token(token_data)
    
    return access_token


async def setup_mfa(
    db: AsyncSession,
    user: User,
    password: str,
) -> tuple[str, str]:
    """Set up MFA for a user"""
    # Verify password
    if not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid password",
        )
    
    # Generate secret
    secret = generate_mfa_secret()
    qr_code_uri = generate_mfa_qr_code(secret, user.email)
    
    # Store secret (user should verify before enabling)
    user.mfa_secret = secret
    await db.commit()
    
    return secret, qr_code_uri


async def enable_mfa(
    db: AsyncSession,
    user: User,
    token: str,
) -> bool:
    """Enable MFA after verification"""
    if not user.mfa_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA not set up. Call setup_mfa first.",
        )
    
    if not verify_mfa_token(user.mfa_secret, token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid MFA token",
        )
    
    user.mfa_enabled = True
    await db.commit()
    
    return True


async def disable_mfa(
    db: AsyncSession,
    user: User,
    password: str,
) -> bool:
    """Disable MFA for a user"""
    # Verify password
    if not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid password",
        )
    
    user.mfa_enabled = False
    user.mfa_secret = None
    await db.commit()
    
    return True

