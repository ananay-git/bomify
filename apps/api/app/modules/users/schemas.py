"""
Pydantic schemas for the Users / Auth module.
"""

from collections.abc import Sequence

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.modules.users.models import Module, UserRole


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)
    # Optional: which login screen was used ("owner" or "staff"). When given, the
    # account must match it, so staff can't sign in through the owner login (and vice versa).
    login_as: UserRole | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---------------------------------------------------------------------------
# User CRUD
# ---------------------------------------------------------------------------


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    full_name: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=6)
    role: UserRole = UserRole.OWNER
    # Ignored for staff accounts — staff only get the task dashboard.
    module_permissions: list[Module] = []


class UserUpdate(BaseModel):
    email: EmailStr | None = None
    full_name: str | None = Field(None, min_length=1, max_length=100)
    is_active: bool | None = None
    module_permissions: list[Module] | None = None


class PasswordReset(BaseModel):
    new_password: str = Field(..., min_length=6, max_length=128)


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    full_name: str
    is_active: bool
    role: UserRole
    module_permissions: list[Module]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserListResponse(BaseModel):
    users: Sequence[UserResponse]
    total: int
