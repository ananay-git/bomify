"""
API endpoints for notifications. Open to any signed-in user (owner or staff) —
each person only ever sees their own.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.notifications import services
from app.modules.notifications.schemas import (
    NotificationListResponse,
    NotificationResponse,
    UnreadCountResponse,
)
from app.modules.users.dependencies import get_current_user
from app.modules.users.models import User

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("/", response_model=NotificationListResponse)
async def list_notifications(
    limit: int = Query(30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Latest notifications for the signed-in user, newest first."""
    items, unread = await services.list_for_user(db, current_user.id, limit)
    return NotificationListResponse(
        notifications=[NotificationResponse.model_validate(n) for n in items],
        unread_count=unread,
    )


@router.post("/read-all", response_model=UnreadCountResponse)
async def read_all(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark every notification as read."""
    return UnreadCountResponse(
        unread_count=await services.mark_all_read(db, current_user.id)
    )


@router.post("/{notification_id}/read", response_model=UnreadCountResponse)
async def read_one(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a single notification as read."""
    return UnreadCountResponse(
        unread_count=await services.mark_read(db, current_user.id, notification_id)
    )
