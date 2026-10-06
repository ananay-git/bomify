"""
Business logic for notifications: create them for a group of people, list them,
and mark them read.
"""

from collections.abc import Sequence
from datetime import datetime, timezone

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.modules.notifications.email import EmailMessage, build_notification_email
from app.modules.notifications.models import Notification
from app.modules.users.models import User, UserRole


async def active_users_with_role(
    db: AsyncSession, role: UserRole, exclude_user_id: int | None = None
) -> list[User]:
    """All active accounts with the given role (optionally leaving one person out)."""
    q = select(User).where(User.role == role, User.is_active.is_(True)).order_by(User.id)
    if exclude_user_id is not None:
        q = q.where(User.id != exclude_user_id)
    result = await db.execute(q)
    return list(result.scalars().all())


async def notify_users(
    db: AsyncSession,
    users: Sequence[User],
    *,
    kind: str,
    title: str,
    message: str,
    link: str | None = None,
    send_email: bool = True,
) -> list[EmailMessage]:
    """Create one in-app notification per user.

    Returns the emails that should be sent. The caller hands them to a
    background task *after* the request, so sending never blocks the response.
    """
    emails: list[EmailMessage] = []
    for user in users:
        db.add(
            Notification(
                user_id=user.id, type=kind, title=title, message=message, link=link
            )
        )
        if send_email and user.email:
            emails.append(
                build_notification_email(
                    user.email, user.full_name, title, message, link
                )
            )
    await db.flush()
    return emails


async def unread_count(db: AsyncSession, user_id: int) -> int:
    result = await db.execute(
        select(func.count(Notification.id)).where(
            Notification.user_id == user_id, Notification.is_read.is_(False)
        )
    )
    return result.scalar_one()


async def list_for_user(
    db: AsyncSession, user_id: int, limit: int = 30
) -> tuple[list[Notification], int]:
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(Notification.id.desc())
        .limit(limit)
    )
    return list(result.scalars().all()), await unread_count(db, user_id)


async def mark_read(db: AsyncSession, user_id: int, notification_id: int) -> int:
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id, Notification.user_id == user_id
        )
    )
    notification = result.scalar_one_or_none()
    if not notification:
        raise NotFoundError("Notification not found")
    if not notification.is_read:
        notification.is_read = True
        notification.read_at = datetime.now(timezone.utc)
        await db.flush()
    return await unread_count(db, user_id)


async def mark_all_read(db: AsyncSession, user_id: int) -> int:
    await db.execute(
        update(Notification)
        .where(Notification.user_id == user_id, Notification.is_read.is_(False))
        .values(is_read=True, read_at=datetime.now(timezone.utc))
    )
    await db.flush()
    return 0
