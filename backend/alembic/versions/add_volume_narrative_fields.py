"""add volume narrative fields

Revision ID: add_volume_narrative_fields
Revises: add_volume_metadata_fields
Create Date: 2025-12-11 19:40:00.000000
"""
from alembic import op


# revision identifiers, used by Alembic.
revision = 'add_volume_narrative_fields'
down_revision = 'add_volume_metadata_fields'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE proposal_volumes ADD COLUMN IF NOT EXISTS executive_summary TEXT")
    op.execute("ALTER TABLE proposal_volumes ADD COLUMN IF NOT EXISTS technical_approach TEXT")


def downgrade() -> None:
    op.execute("ALTER TABLE proposal_volumes DROP COLUMN IF EXISTS technical_approach")
    op.execute("ALTER TABLE proposal_volumes DROP COLUMN IF EXISTS executive_summary")
