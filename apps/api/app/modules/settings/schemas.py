"""
Settings Pydantic schemas for request/response validation.
"""

from pydantic import BaseModel
from typing import Any


class SettingResponse(BaseModel):
    """Single setting key-value pair."""
    id: int
    category: str
    key: str
    value: Any
    description: str | None = None
    updated_by: str | None = None

    model_config = {"from_attributes": True}


class SettingsByCategoryResponse(BaseModel):
    """All settings grouped by category."""
    settings: dict[str, dict[str, Any]]  # { category: { key: value, ... }, ... }


class SettingUpdate(BaseModel):
    """Update a single setting."""
    category: str
    key: str
    value: Any


class SettingBulkUpdate(BaseModel):
    """Bulk update multiple settings at once."""
    settings: list[SettingUpdate]
