"""
FastAPI dependencies for auth and module-based access.
"""

from fastapi import Depends, Header

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.core.security import decode_access_token
from app.modules.users.models import Module, User, UserRole
from app.modules.users.services import get_user_by_id


async def get_current_user(
    authorization: str = Header(..., description="Bearer <token>"),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extract and validate the JWT from the Authorization header."""
    if not authorization.startswith("Bearer "):
        raise UnauthorizedError(detail="Invalid authorization header")

    token = authorization.removeprefix("Bearer ")
    payload = decode_access_token(token)
    if payload is None:
        raise UnauthorizedError(detail="Invalid or expired token")

    user_id: int | None = payload.get("sub")
    if user_id is None:
        raise UnauthorizedError(detail="Invalid token payload")

    user = await get_user_by_id(db, int(user_id))
    if not user.is_active:
        raise UnauthorizedError(detail="Account is deactivated")
    return user


def require_module(module: Module):
    """Returns a dependency that checks the current user has access to the given module."""

    async def module_checker(current_user: User = Depends(get_current_user)) -> User:
        if module not in current_user.modules:
            raise ForbiddenError(
                detail="You do not have permission to access this module"
            )
        return current_user

    return module_checker


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Dependency that requires the user to have the USERS module (admin-level access)."""
    if current_user.role != UserRole.OWNER or Module.USERS not in current_user.modules:
        raise ForbiddenError(detail="Admin access required")
    return current_user


async def require_owner(current_user: User = Depends(get_current_user)) -> User:
    """Dependency that only lets owner accounts through (staff are turned away)."""
    if current_user.role != UserRole.OWNER:
        raise ForbiddenError(detail="This area is only available to the owner")
    return current_user
