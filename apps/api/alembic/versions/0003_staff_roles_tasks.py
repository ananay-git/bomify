"""staff roles, staff tasks and notifications

Revision ID: 0003_staff_roles_tasks
Revises: da126c3defa0
Create Date: 2026-10-04 12:00:00.000000

Adds:
  * users.role              — "owner" (everything) or "staff" (task dashboard only).
                              Existing users become owners, so nothing changes for them.
  * staff_tasks             — production orders the owner has sent to staff.
  * notifications           — in-app / browser notifications for owner and staff.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0003_staff_roles_tasks'
down_revision: Union[str, None] = 'da126c3defa0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── users.role ────────────────────────────────────────────────────────────
    op.add_column(
        'users',
        sa.Column('role', sa.String(length=20), nullable=False, server_default='owner'),
    )
    op.create_index('ix_users_role', 'users', ['role'])

    # ── staff_tasks ───────────────────────────────────────────────────────────
    op.create_table(
        'staff_tasks',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('process_id', sa.Integer(), nullable=False),
        sa.Column('work_order_id', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(length=30), nullable=False, server_default='assigned'),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('assigned_by_id', sa.Integer(), nullable=True),
        sa.Column('assigned_by_name', sa.String(length=100), nullable=True),
        sa.Column('assigned_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_by_id', sa.Integer(), nullable=True),
        sa.Column('completed_by_name', sa.String(length=100), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_quantity', sa.Numeric(10, 2), nullable=True),
        sa.Column('completion_note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['process_id'], ['production_processes.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['work_order_id'], ['work_orders.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['assigned_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['completed_by_id'], ['users.id'], ondelete='SET NULL'),
    )
    op.create_index('ix_staff_tasks_process_id', 'staff_tasks', ['process_id'], unique=True)
    op.create_index('ix_staff_tasks_work_order_id', 'staff_tasks', ['work_order_id'])
    op.create_index('ix_staff_tasks_status', 'staff_tasks', ['status'])

    # ── notifications ─────────────────────────────────────────────────────────
    op.create_table(
        'notifications',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('type', sa.String(length=50), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('link', sa.String(length=300), nullable=True),
        sa.Column('is_read', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_notifications_user_id', 'notifications', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_notifications_user_id', table_name='notifications')
    op.drop_table('notifications')

    op.drop_index('ix_staff_tasks_status', table_name='staff_tasks')
    op.drop_index('ix_staff_tasks_work_order_id', table_name='staff_tasks')
    op.drop_index('ix_staff_tasks_process_id', table_name='staff_tasks')
    op.drop_table('staff_tasks')

    op.drop_index('ix_users_role', table_name='users')
    op.drop_column('users', 'role')
