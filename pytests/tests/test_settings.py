"""
Test Suite — Settings & Health APIs
=====================================
Covers: health check, settings CRUD (admin-only).
"""

import pytest
from httpx import AsyncClient


# ── TC-HEALTH-001: Health check ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"


# ── TC-SET-001: Get all settings ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_all_settings(client: AsyncClient, admin_headers: dict):
    resp = await client.get("/settings/", headers=admin_headers)
    assert resp.status_code == 200
    assert "settings" in resp.json()


# ── TC-SET-002: Get full settings ────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_full_settings(client: AsyncClient, admin_headers: dict):
    resp = await client.get("/settings/full", headers=admin_headers)
    assert resp.status_code == 200
    assert "settings" in resp.json()


# ── TC-SET-003: Get settings by category ─────────────────────────────────

@pytest.mark.asyncio
async def test_get_settings_by_category(client: AsyncClient, admin_headers: dict):
    resp = await client.get("/settings/company", headers=admin_headers)
    assert resp.status_code == 200
    assert "category" in resp.json()


# ── TC-SET-004: Settings require admin ───────────────────────────────────

@pytest.mark.asyncio
async def test_settings_require_admin(client: AsyncClient):
    resp = await client.get("/settings/")
    assert resp.status_code == 422  # No auth header
