"""
QuadStack API — FastAPI Application Entry Point
"""

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.modules.users.router import router as users_router
from app.modules.parties.router import router as parties_router
from app.modules.inventory.router import router as inventory_router
from app.modules.sales.router import router as sales_router
from app.modules.purchases.router import router as purchases_router
from app.modules.production.router import router as production_router
from app.modules.dispatch.router import router as dispatch_router
from app.modules.copilot.router import router as copilot_router
from app.modules.copilot.chart_router import chart_router
from app.modules.settings.router import router as settings_router
from app.modules.notifications.router import router as notifications_router
from app.modules.tasks.router import router as tasks_router, staff_router
from app.modules.users.dependencies import require_owner

app = FastAPI(
    title=f"{settings.CLIENT_NAME} — Operations Management API",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — allow the frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
#
# Login, profile and user management live in users_router (they have their own checks).
app.include_router(users_router, prefix="/api")

# Everything below is the owner's side of the software. Staff accounts are turned
# away here, no matter what a particular endpoint checks for itself.
_owner_only = [Depends(require_owner)]
app.include_router(parties_router, prefix="/api", dependencies=_owner_only)
app.include_router(inventory_router, prefix="/api", dependencies=_owner_only)
app.include_router(sales_router, prefix="/api", dependencies=_owner_only)
app.include_router(purchases_router, prefix="/api", dependencies=_owner_only)
app.include_router(production_router, prefix="/api", dependencies=_owner_only)
app.include_router(dispatch_router, prefix="/api", dependencies=_owner_only)
app.include_router(copilot_router, prefix="/api", dependencies=_owner_only)
app.include_router(chart_router, prefix="/api")
app.include_router(settings_router, prefix="/api", dependencies=_owner_only)

# Shared by owner and staff: notifications, plus the task endpoints
# (tasks_router is owner-only per endpoint; staff_router is for the shop floor).
app.include_router(notifications_router, prefix="/api")
app.include_router(tasks_router, prefix="/api")
app.include_router(staff_router, prefix="/api")

@app.get("/api/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "client": settings.CLIENT_NAME}
