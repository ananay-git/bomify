"""
Test Suite — Authentication & User Management APIs
===================================================
Covers: login, profile, CRUD (admin-only), password reset, deletion.
"""

import pytest
from httpx import AsyncClient


# ── TC-AUTH-001: Successful admin login ────────────────────────────────────

@pytest.mark.asyncio
async def test_admin_login_success(client: AsyncClient):
    resp = await client.post("/users/login", json={
        "username": "admin",
        "password": "admin123",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


# ── TC-AUTH-002: Login with wrong password ─────────────────────────────────

@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    resp = await client.post("/users/login", json={
        "username": "admin",
        "password": "wrongpassword",
    })
    assert resp.status_code in (401, 403)


# ── TC-AUTH-003: Login with non-existent user ──────────────────────────────

@pytest.mark.asyncio
async def test_login_nonexistent_user(client: AsyncClient):
    resp = await client.post("/users/login", json={
        "username": "ghost_user",
        "password": "password123",
    })
    assert resp.status_code in (401, 404)


# ── TC-AUTH-004: Get current user profile ──────────────────────────────────

@pytest.mark.asyncio
async def test_get_current_profile(client: AsyncClient, admin_headers: dict):
    resp = await client.get("/users/me", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["username"] == "admin"
    assert data["email"] == "admin@quadstack.local"
    assert data["is_active"] is True


# ── TC-AUTH-005: Access protected route without token ──────────────────────

@pytest.mark.asyncio
async def test_protected_route_no_token(client: AsyncClient):
    resp = await client.get("/users/me")
    assert resp.status_code == 422  # missing header


# ── TC-USER-001: List users (admin) ───────────────────────────────────────

@pytest.mark.asyncio
async def test_list_users(client: AsyncClient, admin_headers: dict):
    resp = await client.get("/users/", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "users" in data
    assert "total" in data
    assert data["total"] >= 1


# ── TC-USER-002: Create user ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_user(client: AsyncClient, admin_headers: dict):
    resp = await client.post("/users/", json={
        "username": "testuser_m4",
        "email": "testuser_m4@quadstack.local",
        "full_name": "Test User M4",
        "password": "password123",
        "module_permissions": ["dashboard", "sales", "inventory"],
    }, headers=admin_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["username"] == "testuser_m4"
    assert "dashboard" in data["module_permissions"]


# ── TC-USER-003: Get user by ID ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_user_by_id(client: AsyncClient, admin_headers: dict):
    # List users, pick the first one
    resp = await client.get("/users/", headers=admin_headers)
    users = resp.json()["users"]
    user_id = users[0]["id"]

    resp = await client.get(f"/users/{user_id}", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == user_id


# ── TC-USER-004: Update user ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_update_user(client: AsyncClient, admin_headers: dict):
    # Get list, find testuser_m4
    resp = await client.get("/users/?limit=100", headers=admin_headers)
    users = resp.json()["users"]
    target = next((u for u in users if u["username"] == "testuser_m4"), None)
    if target is None:
        pytest.skip("testuser_m4 not found")

    resp = await client.patch(f"/users/{target['id']}", json={
        "full_name": "Updated Test User",
    }, headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["full_name"] == "Updated Test User"


# ── TC-USER-005: Reset password ───────────────────────────────────────────

@pytest.mark.asyncio
async def test_reset_password(client: AsyncClient, admin_headers: dict):
    resp = await client.get("/users/?limit=100", headers=admin_headers)
    users = resp.json()["users"]
    target = next((u for u in users if u["username"] == "testuser_m4"), None)
    if target is None:
        pytest.skip("testuser_m4 not found")

    resp = await client.post(f"/users/{target['id']}/reset-password", json={
        "new_password": "newpassword456",
    }, headers=admin_headers)
    assert resp.status_code == 200


# ── TC-USER-006: Delete user ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_delete_user(client: AsyncClient, admin_headers: dict):
    resp = await client.get("/users/?limit=100", headers=admin_headers)
    users = resp.json()["users"]
    target = next((u for u in users if u["username"] == "testuser_m4"), None)
    if target is None:
        pytest.skip("testuser_m4 not found")

    resp = await client.delete(f"/users/{target['id']}", headers=admin_headers)
    assert resp.status_code == 204
