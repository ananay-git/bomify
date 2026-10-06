"""
API endpoints for authentication and user management.
"""

from datetime import timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token
from app.modules.users.dependencies import get_current_user, require_admin
from app.modules.users.models import User, UserRole
from app.modules.users.schemas import (
    LoginRequest,
    PasswordReset,
    TokenResponse,
    UserCreate,
    UserListResponse,
    UserResponse,
    UserUpdate,
)
from app.modules.users import services

router = APIRouter(prefix="/users", tags=["Users & Auth"])


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate with username + password, returns a JWT."""
    user = await services.authenticate_user(
        db, body.username, body.password, login_as=body.login_as
    )
    expires = (
        timedelta(minutes=settings.STAFF_ACCESS_TOKEN_EXPIRE_MINUTES)
        if user.role == UserRole.STAFF
        else None  # owners use the default lifetime
    )
    token = create_access_token(data={"sub": str(user.id)}, expires_delta=expires)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
async def get_current_profile(current_user: User = Depends(get_current_user)):
    """Return the profile of the currently authenticated user."""
    return current_user


# ---------------------------------------------------------------------------
# User CRUD (Admin only)
# ---------------------------------------------------------------------------


@router.get("/", response_model=UserListResponse)
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """List all users (Admin only)."""
    users, total = await services.list_users(db, skip=skip, limit=limit)
    return UserListResponse(
        users=[UserResponse.model_validate(u) for u in users],
        total=total,
    )


@router.post("/", response_model=UserResponse, status_code=201)
async def create_user(
    body: UserCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Create a new user (Admin only)."""
    return await services.create_user(db, body)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Get a specific user by ID (Admin only)."""
    return await services.get_user_by_id(db, user_id)


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    body: UserUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Update a user (Admin only)."""
    return await services.update_user(db, user_id, body)


@router.post("/{user_id}/reset-password", response_model=UserResponse)
async def reset_password(
    user_id: int,
    body: PasswordReset,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Reset a user's password (Admin only)."""
    return await services.reset_user_password(db, user_id, body.new_password)


@router.delete("/{user_id}", status_code=204)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Delete a user (Admin only)."""
    await services.delete_user(db, user_id, current_user_id=admin.id)
