import asyncio
import logging
import os
import secrets
import string
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import async_session
from app.core.security import hash_password
from app.modules.users.models import User, UserRole

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _get_seed_password(env_var: str, fallback_label: str) -> str:
    """
    Read the seed password from environment variable.
    If not set, generate a secure random password and log it once.
    """
    password = os.environ.get(env_var)
    if password:
        return password
    # Generate a random 16-char password
    alphabet = string.ascii_letters + string.digits + string.punctuation
    password = ''.join(secrets.choice(alphabet) for _ in range(16))
    logger.warning(
        "No %s env var set. Generated random password for %s: %s  "
        "⚠️  Save this now — it will NOT be shown again.",
        env_var, fallback_label, password,
    )
    return password


async def seed_data():
    logger.info("Starting database seeding...")
    async with async_session() as session:
        # Create default admin user
        result = await session.execute(select(User).where(User.username == "admin"))
        admin_user = result.scalar_one_or_none()
        
        if not admin_user:
            admin_password = _get_seed_password("SEED_ADMIN_PASSWORD", "admin")
            logger.info("Creating default admin user...")
            admin_user = User(
                username="admin",
                email="admin@quadstack.local",
                full_name="System Admin",
                hashed_password=hash_password(admin_password),
                role=UserRole.ADMIN,
                is_active=True
            )
            session.add(admin_user)
            await session.flush()
        else:
            logger.info("Admin user already exists. Skipping.")
            
        # Create a test employee
        result = await session.execute(select(User).where(User.username == "manager"))
        manager = result.scalar_one_or_none()
        if not manager:
            manager_password = _get_seed_password("SEED_MANAGER_PASSWORD", "manager")
            logger.info("Creating test manager user...")
            manager = User(
                username="manager",
                email="manager@quadstack.local",
                full_name="Production Manager",
                hashed_password=hash_password(manager_password),
                role=UserRole.PRODUCTION_MANAGER,
                is_active=True
            )
            session.add(manager)
            await session.flush()
            
        await session.commit()
    logger.info("Database seeding completed.")

if __name__ == "__main__":
    asyncio.run(seed_data())
