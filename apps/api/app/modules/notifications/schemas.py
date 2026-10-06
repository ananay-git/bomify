"""
Pydantic schemas for the Notifications module.
"""

from collections.abc import Sequence
from datetime import datetime

from pydantic import BaseModel


class NotificationResponse(BaseModel):
    id: int
    type: str
    title: str
    message: str
    link: str | None = None
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationListResponse(BaseModel):
    notifications: Sequence[NotificationResponse]
    unread_count: int


class UnreadCountResponse(BaseModel):
    unread_count: int
