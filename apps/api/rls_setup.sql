-- =================================================================
-- QuadStack Copilot — PostgreSQL Read-Only Role Setup
--
-- Run ONCE after migrations (tables must exist first):
--   docker exec -i <db-container> psql -U quadstack -d quadstack < apps/api/rls_setup.sql
--
-- This role is used by the LangGraph copilot agent so it can only
-- SELECT data — it cannot INSERT, UPDATE, DELETE, or DROP anything.
-- Future: enable per-table ROW SECURITY policies here to scope the
--         copilot's visibility to the authenticated user's data.
-- =================================================================

-- 1. Create the restricted login role (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'copilot_reader') THEN
        CREATE ROLE copilot_reader WITH LOGIN PASSWORD 'copilot_reader_pass' NOINHERIT;
        RAISE NOTICE 'Role copilot_reader created.';
    ELSE
        RAISE NOTICE 'Role copilot_reader already exists, skipping creation.';
    END IF;
END
$$;

-- 2. Allow the role to connect to this database
GRANT CONNECT ON DATABASE quadstack TO copilot_reader;

-- 3. Allow visibility into the public schema
GRANT USAGE ON SCHEMA public TO copilot_reader;

-- 4. SELECT on all tables that exist today
GRANT SELECT ON ALL TABLES IN SCHEMA public TO copilot_reader;

-- 5. SELECT on all tables created by future Alembic migrations
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT ON TABLES TO copilot_reader;

-- 6. Allow SELECT on sequences (needed for some ORM introspection)
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO copilot_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT ON SEQUENCES TO copilot_reader;

-- =================================================================
-- Verification (optional — run manually to confirm):
--   \c quadstack copilot_reader
--   SELECT count(*) FROM users;          -- should work
--   INSERT INTO users VALUES (...);      -- should FAIL with permission denied
-- =================================================================
