# QuadStack: Manufacturing Operations Management Platform

A full-stack operations platform for manufacturing workflows, with a FastAPI backend, React frontend, PostgreSQL, Redis, and an integrated AI copilot module.

## Quick Start (2 Minutes)
### Option 1: Docker Compose (Recommended)
Run the full stack (PostgreSQL + Redis + API + Web) with hot reload
```bash
docker compose up --build
```
If your Docker setup uses the legacy command:
```bash
docker-compose up --build
```
Services:
- Frontend: http://localhost:5173
- API: http://localhost:8000
- API docs (Swagger): http://localhost:8000/docs
- Email inbox (Mailpit, catches every email the app sends): http://localhost:8025
Default seeded admin credentials (development):
- Username: `admin`
- Email: `admin@quadstack.local`
- Password: `admin123`


## Owner and Staff

QuadStack has two kinds of accounts, each with its own login:

| | Owner | Staff |
|---|---|---|
| Sees | Everything (the modules you give them) | One shared task dashboard, nothing else |
| Logs in on | the **Owner** tab of the login page | the **Staff** tab of the login page |
| Gets | A bell with updates, browser alerts and emails when an order is ready to dispatch | A bell, browser alerts and emails when a new order is assigned |

The seeded `admin` account is an owner. Staff cannot open or call any owner screen or API.

### Create a staff account
Sign in as owner, open **Users & Team**, click **Add User**, and set **Account type** to **Staff**.
Use a real email address: that is where order emails go.

### The order loop

1. **Owner assigns an order.** Production, then the **Work Orders** tab, then the blue send icon (**Assign to staff**). Add an optional note. If production hasn't started, it starts automatically.
2. **Every staff member is notified** with a browser pop-up and an email, and the order appears on the staff dashboard. Everyone sees the same list.
3. **Staff finish it.** On the dashboard they press **Done, ready for dispatch** and enter how many they finished. This completes the production process, so finished goods are added to stock and materials are deducted, exactly like the owner's **Mark as Complete** button.
4. **The owner is notified** (bell, browser pop-up and email) with a link that opens the dispatch screen for that order. The owner dispatches it.

The owner can withdraw an order that staff haven't finished (the undo icon on the Work Orders tab).

### Notifications

- **Bell**: owners find it in the sidebar, staff in the top bar. It shows unread notifications and updates every 10 seconds.
- **Browser alerts**: each person turns them on once (the bell menu, or the banner on the staff dashboard) and allows notifications when the browser asks. Pop-ups appear while QuadStack is open in a browser tab, even a background tab. They work on `localhost`; any other address needs HTTPS. If the browser is fully closed, the email still arrives.
- **Email**: with Docker Compose, emails go to a local inbox at http://localhost:8025, so you can see them without any setup. To send real email, add these to your `.env` file and restart:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=you@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=QuadStack <you@gmail.com>
SMTP_USE_TLS=true
APP_BASE_URL=http://localhost:5173
```

  Gmail needs an "App password" (Google Account, Security, 2-Step Verification). Leave `SMTP_HOST` empty to switch email off; the bell and browser alerts keep working.
- Staff sessions last 12 hours (`STAFF_ACCESS_TOKEN_EXPIRE_MINUTES`) so a dashboard left open on a shop-floor screen keeps receiving alerts.

## Architecture Snapshot

- `apps/api`: FastAPI backend, SQLAlchemy, Alembic migrations, Redis-backed features, JWT auth, seed utilities.
- `apps/web`: React + Vite + TypeScript frontend with Ant Design and Tailwind.
- Root workspace: Turborepo monorepo orchestration (`dev`, `build`, `lint`).

## Available Scripts

### Root
- `npm run dev` → Run all apps (Turborepo)
- `npm run build` → Build all packages
- `npm run lint` → Lint all workspaces

### API (`apps/api`)
- `npm run dev --workspace=api` → Run FastAPI (port 8000, Windows)
- `npm run dev:unix --workspace=api` → Same (Unix)

### Web (`apps/web`)
- `npm run dev --workspace=web` → Start Vite
- `npm run build --workspace=web` → Build + type-check
- `npm run lint --workspace=web` → Run ESLint
- `npm run preview --workspace=web` → Preview build


## Database, Migrations, and Seed
From `apps/api`:
Run migrations:
```bash
alembic upgrade head
```
Create a new migration:
```bash
alembic revision --autogenerate -m "your_migration_name"
```
Run seed manually:
```bash
python -m app.seed
```

## How to Use Testing

The repository includes API integration tests under [pytests/tests](pytests/tests), configured by [pytests/tests/conftest.py](pytests/tests/conftest.py).

What these tests cover:
- Authentication and users
- Parties
- Inventory
- Sales
- Purchases
- Production
- Dispatch
- Settings and health APIs
- Owner/staff roles, staff tasks and notifications (`test_staff_tasks.py`)

### 1) Start required services

These tests expect PostgreSQL and Redis to be available.

Using Docker (recommended):

```bash
docker compose up -d db redis
```

Or run local services on:
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

### 2) Prepare API virtual environment

From `apps/api`, install test dependencies into `apps/api/.venv`.

Windows:

```bash
cd apps/api
.venv\Scripts\pip install pytest pytest-asyncio pytest-cov httpx
```

macOS/Linux:

```bash
cd apps/api
.venv/bin/pip install pytest pytest-asyncio pytest-cov httpx
```

### 3) Run tests

From repository root:

Windows:

```bash
apps\api\.venv\Scripts\python.exe -m pytest pytests/tests -v
```

macOS/Linux:

```bash
apps/api/.venv/bin/python -m pytest pytests/tests -v
```

Run a single file:

```bash
apps\api\.venv\Scripts\python.exe -m pytest pytests/tests/test_settings.py -v
```

Run with coverage:

```bash
apps\api\.venv\Scripts\python.exe -m pytest pytests/tests --cov=app --cov-report=term-missing
```

## Environment Variables

Primary environment variables are defined in [.env.example](./.env.example):
- App/client identity and environment mode
- PostgreSQL connection settings
- Redis URL
- JWT settings
- Seeded admin credentials
- Copilot agent configuration (`GOOGLE_API_KEY`, model and timeout settings)
- Email settings (`SMTP_*`, `APP_BASE_URL`) and staff session length

Note: `apps/api/app/core/config.py` reads from `.env` using Pydantic settings.

