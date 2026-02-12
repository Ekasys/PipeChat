"""Role-based access control (RBAC) logic"""
from enum import Enum
from typing import List, Set


class Role(str, Enum):
    """User roles"""
    ADMIN = "admin"
    CAPTURE = "capture"
    PROPOSAL = "proposal"
    ANALYST = "analyst"


# Permission definitions
PERMISSIONS = {
    Role.ADMIN: {
        "users:create",
        "users:read",
        "users:update",
        "users:delete",
        "tenants:manage",
        "settings:manage",
        "audit:read",
        "reports:generate",
    },
    Role.CAPTURE: {
        "opportunities:create",
        "opportunities:read",
        "opportunities:update",
        "opportunities:delete",
        "market_intel:read",
        "market_intel:update",
        "crm:read",
        "crm:update",
        "pwin:read",
        "pwin:update",
    },
    Role.PROPOSAL: {
        "proposals:create",
        "proposals:read",
        "proposals:update",
        "proposals:delete",
        "proposals:review",
        "documents:upload",
        "documents:read",
        "ai:use",
    },
    Role.ANALYST: {
        "opportunities:read",
        "market_intel:read",
        "crm:read",
        "ptw:read",
        "ptw:update",
        "pwin:read",
        "pwin:update",
        "reports:read",
        "dashboard:read",
    },
}


def get_permissions(role: Role) -> Set[str]:
    """Get permissions for a role"""
    return PERMISSIONS.get(role, set())


def has_permission(role: Role, permission: str) -> bool:
    """Check if a role has a specific permission"""
    role_perms = get_permissions(role)
    return permission in role_perms


def require_permission(permission: str):
    """Decorator factory for permission checking"""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            # Get user from kwargs (should be injected by dependency)
            user = kwargs.get("user")
            if not user:
                raise ValueError("User not found in function arguments")
            
            if not has_permission(Role(user.role), permission):
                from fastapi import HTTPException, status
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Permission denied: {permission}",
                )
            return await func(*args, **kwargs)
        return wrapper
    return decorator


