"""add volume metadata fields

Revision ID: add_volume_metadata_fields
Revises: a1b2c3d4e5f6
Create Date: 2025-12-11 19:30:00.000000
"""
from alembic import op


# revision identifiers, used by Alembic.
revision = 'add_volume_metadata_fields'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE proposal_volumes ADD COLUMN IF NOT EXISTS page_limit VARCHAR(50)")
    op.execute("ALTER TABLE proposal_volumes ADD COLUMN IF NOT EXISTS rfp_sections JSON")


def downgrade() -> None:
    op.execute("ALTER TABLE proposal_volumes DROP COLUMN IF EXISTS rfp_sections")
    op.execute("ALTER TABLE proposal_volumes DROP COLUMN IF EXISTS page_limit")
