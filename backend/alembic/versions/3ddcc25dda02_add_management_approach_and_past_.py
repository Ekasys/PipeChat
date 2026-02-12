"""Add management_approach and past_performance to proposals

Revision ID: 3ddcc25dda02
Revises: 001
Create Date: 2025-11-09 15:12:44.492804

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '3ddcc25dda02'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Idempotent for environments where these columns were added manually.
    op.execute("ALTER TABLE proposals ADD COLUMN IF NOT EXISTS management_approach TEXT")
    op.execute("ALTER TABLE proposals ADD COLUMN IF NOT EXISTS past_performance TEXT")


def downgrade() -> None:
    op.execute("ALTER TABLE proposals DROP COLUMN IF EXISTS past_performance")
    op.execute("ALTER TABLE proposals DROP COLUMN IF EXISTS management_approach")

