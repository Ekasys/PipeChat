"""Add account_type field to accounts table

Revision ID: add_account_type
Revises: add_volume_narrative_fields
Create Date: 2024-01-01 12:00:00.000000

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = 'add_account_type'
down_revision = '4d5de7c1c2b4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS account_type VARCHAR(50)")


def downgrade() -> None:
    op.execute("ALTER TABLE accounts DROP COLUMN IF EXISTS account_type")
