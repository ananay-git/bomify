import asyncio
from sqlalchemy import create_engine
from app.core.config import settings
from app.core.database import Base

# Import all models to attach to metadata
import app.modules.users.models
import app.modules.parties.models
import app.modules.inventory.models
import app.modules.sales.models
import app.modules.purchases.models
import app.modules.production.models
import app.modules.dispatch.models
import app.modules.copilot.models
import app.modules.settings.models
import app.modules.notifications.models
import app.modules.tasks.models

def create():
    engine = create_engine(settings.DATABASE_URL_SYNC)
    Base.metadata.create_all(bind=engine)
    print("Tables created successfully!")

if __name__ == "__main__":
    create()
