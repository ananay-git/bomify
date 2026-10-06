"""
Business logic for the Users / Auth module.
"""

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    ConflictError,
    ForbiddenError,
    NotFoundError,
    UnauthorizedError,
)
from app.core.security import hash_password, verify_password
from app.modules.users.models import Module, User, UserModuleAccess, UserRole
from app.modules.users.schemas import UserCreate, UserUpdate

# Modules automatically granted to every user
_AUTO_GRANT = {Module.DASHBOARD, Module.PARTIES}


async def authenticate_user(
    db: AsyncSession,
    username: str,
    password: str,
    login_as: UserRole | None = None,
) -> User:
    """Verify credentials and return the user, or raise UnauthorizedError.

    If ``login_as`` is given, the account's role must match the login screen used.
    """
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, user.hashed_password):
        raise UnauthorizedError(detail="Incorrect username or password")
    if not user.is_active:
        raise UnauthorizedError(detail="Account is deactivated")
    if login_as is not None and user.role != login_as:
        # Right password, wrong door: 403 (not 401) so the web app shows the message
        # instead of treating it as an expired session.
        if user.role == UserRole.STAFF:
            raise ForbiddenError(
                detail="This is a staff account. Please use the Staff login."
            )
        raise ForbiddenError(
            detail="This is an owner account. Please use the Owner login."
        )
    return user


async def create_user(db: AsyncSession, data: UserCreate) -> User:
    """Create a new user. Raises ConflictError if username/email already exists."""
    existing = await db.execute(
        select(User).where(
            (User.username == data.username) | (User.email == data.email)
        )
    )
    if existing.scalar_one_or_none():
        raise ConflictError(detail="Username or email already exists")

    user = User(
        username=data.username,
        email=data.email,
        full_name=data.full_name,
        hashed_password=hash_password(data.password),
        role=data.role,
    )
    db.add(user)
    await db.flush()  # assigns user.id

    # Staff never get owner modules — they only see the task dashboard.
    if data.role == UserRole.OWNER:
        all_modules = set(data.module_permissions) | _AUTO_GRANT
        for mod in all_modules:
            db.add(UserModuleAccess(user_id=user.id, module=mod))

    await db.flush()
    await db.refresh(user)
    return user


async def get_user_by_id(db: AsyncSession, user_id: int) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise NotFoundError(detail=f"User with id {user_id} not found")
    return user


async def list_users(
    db: AsyncSession, skip: int = 0, limit: int = 50
) -> tuple[list[User], int]:
    total_result = await db.execute(select(func.count(User.id)))
    total = total_result.scalar_one()

    result = await db.execute(select(User).offset(skip).limit(limit).order_by(User.id))
    users = list(result.scalars().all())
    return users, total


async def update_user(db: AsyncSession, user_id: int, data: UserUpdate) -> User:
    user = await get_user_by_id(db, user_id)
    update_data = data.model_dump(exclude_unset=True)

    new_modules = update_data.pop("module_permissions", None)

    for field, value in update_data.items():
        setattr(user, field, value)

    if new_modules is not None and user.role == UserRole.OWNER:
        await db.execute(
            delete(UserModuleAccess).where(UserModuleAccess.user_id == user_id)
        )
        all_modules = set(new_modules) | _AUTO_GRANT
        for mod in all_modules:
            db.add(UserModuleAccess(user_id=user.id, module=mod))

    await db.flush()
    await db.refresh(user)
    return user


async def reset_user_password(
    db: AsyncSession, user_id: int, new_password: str
) -> User:
    """Admin resets another user's password."""
    user = await get_user_by_id(db, user_id)
    user.hashed_password = hash_password(new_password)
    await db.flush()
    await db.refresh(user)
    return user


async def delete_user(db: AsyncSession, user_id: int, current_user_id: int) -> None:
    """Delete a user. Admins cannot delete themselves."""
    if user_id == current_user_id:
        from app.core.exceptions import ForbiddenError

        raise ForbiddenError(detail="You cannot delete your own account")
    user = await get_user_by_id(db, user_id)
    await db.delete(user)
    await db.flush()
