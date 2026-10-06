"""add_orderstatus_v2

Revision ID: da126c3defa0
Revises: 0001_initial_schema
Create Date: 2026-04-10 12:53:48.562508

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM


# revision identifiers, used by Alembic.
revision: str = 'da126c3defa0'
down_revision: Union[str, None] = '0001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create the new ENUM type
    orderstatus_v2 = ENUM(
        'DRAFT', 'QUOTATION_SENT', 'CONFIRMED', 'PROCESSING', 
        'SHIPPED', 'INVOICED', 'PAID', 'CANCELLED', 
        name='orderstatus_v2', create_type=False
    )
    orderstatus_v2.create(op.get_bind(), checkfirst=True)

    # Alter the column to use the new ENUM type
    op.execute(
        "ALTER TABLE sales_orders ALTER COLUMN status TYPE orderstatus_v2 USING status::text::orderstatus_v2"
    )


def downgrade() -> None:
    # Revert to previous ENUM type or varying character depending on existing state
    # We'll just cast back to salesorderstatus.
    op.execute(
        "ALTER TABLE sales_orders ALTER COLUMN status TYPE salesorderstatus USING status::text::salesorderstatus"
    )
    op.execute("DROP TYPE orderstatus_v2")
