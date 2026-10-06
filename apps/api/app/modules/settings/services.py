"""
Settings service layer — CRUD operations and default seed logic.
"""

from collections import defaultdict
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.settings.models import Setting


# ─── Default Settings ───────────────────────────────────────────────
# These are seeded on first run. Format: (category, key, value, description)

DEFAULT_SETTINGS: list[tuple[str, str, Any, str]] = [
    # Company Profile
    ("company", "company_name", "QuadStack", "Legal entity / company name"),
    ("company", "company_logo", None, "Company logo (base64 or URL)"),
    ("company", "address", {"line1": "", "line2": "", "city": "", "state": "", "pincode": "", "country": "India"}, "Registered office address"),
    ("company", "gstin", "", "Company GSTIN number"),
    ("company", "pan", "", "Company PAN number"),
    ("company", "phone", "", "Primary contact phone"),
    ("company", "email", "", "Primary email address"),
    ("company", "website", "", "Company website URL"),
    ("company", "fiscal_year_start", "04-01", "Fiscal year start date (MM-DD)"),
    ("company", "default_currency", "INR", "Default / base currency"),

    # Module Configuration
    ("modules", "sales_enabled", True, "Enable the Sales module"),
    ("modules", "purchases_enabled", True, "Enable the Purchases module"),
    ("modules", "production_enabled", True, "Enable the Production module"),
    ("modules", "inventory_enabled", True, "Enable the Inventory module"),
    ("modules", "dispatch_enabled", True, "Enable the Dispatch module"),
    ("modules", "copilot_enabled", True, "Enable the AI Copilot module"),

    # Document Numbering Series
    ("numbering", "sales_order_prefix", "SO-", "Sales Order document prefix"),
    ("numbering", "sales_order_next", 1, "Next Sales Order sequence number"),
    ("numbering", "purchase_order_prefix", "PO-", "Purchase Order document prefix"),
    ("numbering", "purchase_order_next", 1, "Next Purchase Order sequence number"),
    ("numbering", "work_order_prefix", "WO-", "Work Order document prefix"),
    ("numbering", "work_order_next", 1, "Next Work Order sequence number"),
    ("numbering", "dispatch_prefix", "DC-", "Dispatch / Challan prefix"),
    ("numbering", "dispatch_next", 1, "Next Dispatch sequence number"),
    ("numbering", "invoice_prefix", "INV-", "Invoice document prefix"),
    ("numbering", "invoice_next", 1, "Next Invoice sequence number"),
    ("numbering", "grn_prefix", "GRN-", "Goods Receipt Note prefix"),
    ("numbering", "grn_next", 1, "Next GRN sequence number"),

    # Tax & Currency
    ("tax", "default_tax_rate", 18, "Default tax rate (%)"),
    ("tax", "tax_type", "GST", "Tax system — GST, VAT, etc."),
    ("tax", "tax_id_label", "GSTIN", "Label for the tax identification field"),
    ("tax", "enable_tds", False, "Enable TDS (Tax Deducted at Source)"),
    ("tax", "enable_tcs", False, "Enable TCS (Tax Collected at Source)"),
    ("tax", "round_off_total", True, "Round document totals to nearest integer"),

    # Workflow & Approvals
    ("workflow", "po_approval_required", False, "Require approval before submitting Purchase Orders"),
    ("workflow", "po_approval_threshold", 50000, "Auto-approve POs below this amount (₹)"),
    ("workflow", "so_approval_required", False, "Require approval before submitting Sales Orders"),
    ("workflow", "so_approval_threshold", 100000, "Auto-approve SOs below this amount (₹)"),
    ("workflow", "dispatch_approval_required", False, "Require approval before dispatching"),
    ("workflow", "auto_confirm_orders", False, "Automatically confirm orders on creation"),

    # Email & Notifications
    ("notifications", "email_on_order_create", False, "Send email when a new order is created"),
    ("notifications", "email_on_dispatch", False, "Send email on dispatch shipment"),
    ("notifications", "low_stock_alert", True, "Enable low stock alerts"),
    ("notifications", "low_stock_threshold", 10, "Alert when stock falls below this quantity"),
    ("notifications", "smtp_host", "", "SMTP mail server hostname"),
    ("notifications", "smtp_port", 587, "SMTP mail server port"),
    ("notifications", "smtp_user", "", "SMTP username / email"),
    ("notifications", "smtp_password", "", "SMTP password"),
    ("notifications", "notification_email", "", "Email to receive system notifications"),

    # System / General
    ("system", "date_format", "DD/MM/YYYY", "Display date format across the app"),
    ("system", "timezone", "Asia/Kolkata", "System timezone"),
    ("system", "items_per_page", 25, "Default items per page in list views"),
    ("system", "enable_audit_log", True, "Log all document changes for auditing"),
    ("system", "maintenance_mode", False, "Lock out non-admin users (maintenance)"),
    ("system", "session_timeout_minutes", 60, "Session timeout in minutes"),
    ("system", "backup_frequency", "daily", "Automatic backup frequency"),
]


# ─── Service Functions ──────────────────────────────────────────────


async def get_all_settings(db: AsyncSession) -> dict[str, dict[str, Any]]:
    """Return all settings grouped by category."""
    result = await db.execute(select(Setting).order_by(Setting.category, Setting.key))
    rows = result.scalars().all()

    grouped: dict[str, dict[str, Any]] = defaultdict(dict)
    for row in rows:
        grouped[row.category][row.key] = row.value
    return dict(grouped)


async def get_all_settings_full(db: AsyncSession) -> list[Setting]:
    """Return all settings as full ORM objects (with descriptions, etc.)."""
    result = await db.execute(select(Setting).order_by(Setting.category, Setting.key))
    return list(result.scalars().all())


async def get_settings_by_category(db: AsyncSession, category: str) -> dict[str, Any]:
    """Return all settings for a specific category as a flat dict."""
    result = await db.execute(
        select(Setting).where(Setting.category == category).order_by(Setting.key)
    )
    rows = result.scalars().all()
    return {row.key: row.value for row in rows}


async def get_setting(db: AsyncSession, category: str, key: str) -> Any:
    """Get a single setting value."""
    result = await db.execute(
        select(Setting).where(Setting.category == category, Setting.key == key)
    )
    row = result.scalar_one_or_none()
    return row.value if row else None


async def update_setting(
    db: AsyncSession, category: str, key: str, value: Any, updated_by: str = "system"
) -> Setting:
    """Update a single setting (upsert)."""
    result = await db.execute(
        select(Setting).where(Setting.category == category, Setting.key == key)
    )
    row = result.scalar_one_or_none()

    if row:
        row.value = value
        row.updated_by = updated_by
    else:
        row = Setting(
            category=category,
            key=key,
            value=value,
            updated_by=updated_by,
        )
        db.add(row)

    await db.flush()
    return row


async def bulk_update_settings(
    db: AsyncSession, updates: list[dict], updated_by: str = "system"
) -> list[Setting]:
    """Update multiple settings at once."""
    results = []
    for upd in updates:
        setting = await update_setting(
            db, upd["category"], upd["key"], upd["value"], updated_by
        )
        results.append(setting)
    return results


async def seed_default_settings(db: AsyncSession) -> None:
    """
    Populate default settings if they don't already exist.
    Called during seed.py — safe to run multiple times.
    """
    existing = await db.execute(select(Setting))
    existing_keys = {(s.category, s.key) for s in existing.scalars().all()}

    new_count = 0
    for category, key, value, description in DEFAULT_SETTINGS:
        if (category, key) not in existing_keys:
            db.add(Setting(
                category=category,
                key=key,
                value=value,
                description=description,
                updated_by="system",
            ))
            new_count += 1

    if new_count > 0:
        await db.flush()
        print(f"Seeded {new_count} default settings.")
    else:
        print("All default settings already exist, skipping.")
