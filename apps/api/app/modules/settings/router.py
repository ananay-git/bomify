"""
API endpoints for ERP Settings management (Admin only).
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.users.dependencies import require_admin
from app.modules.users.models import User
from app.modules.settings.schemas import (
    SettingResponse,
    SettingsByCategoryResponse,
    SettingBulkUpdate,
    SettingUpdate,
)
from app.modules.settings import services

router = APIRouter(prefix="/settings", tags=["Settings"])


# ---------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------


@router.get("/", response_model=SettingsByCategoryResponse)
async def get_all_settings(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Return all settings grouped by category (Admin only)."""
    grouped = await services.get_all_settings(db)
    return SettingsByCategoryResponse(settings=grouped)


@router.get("/full")
async def get_all_settings_full(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Return all settings with full details including descriptions (Admin only)."""
    rows = await services.get_all_settings_full(db)
    return {
        "settings": [
            SettingResponse.model_validate(r) for r in rows
        ]
    }


@router.get("/{category}")
async def get_settings_by_category(
    category: str,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Return all settings for a specific category (Admin only)."""
    data = await services.get_settings_by_category(db, category)
    return {"category": category, "settings": data}


# ---------------------------------------------------------------------------
# Write
# ---------------------------------------------------------------------------


@router.put("/", response_model=dict)
async def bulk_update_settings(
    body: SettingBulkUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Bulk update multiple settings at once (Admin only)."""
    updates = [s.model_dump() for s in body.settings]
    results = await services.bulk_update_settings(db, updates, updated_by=admin.username)
    return {
        "message": f"Updated {len(results)} settings successfully.",
        "updated": len(results),
    }


@router.put("/{category}/{key}", response_model=SettingResponse)
async def update_single_setting(
    category: str,
    key: str,
    body: SettingUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Update a single setting by category and key (Admin only)."""
    setting = await services.update_setting(
        db, category, key, body.value, updated_by=admin.username
    )
    return SettingResponse.model_validate(setting)
