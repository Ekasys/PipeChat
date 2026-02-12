"""extend opportunity fields"""
from alembic import op


# revision identifiers, used by Alembic.
revision = '4d5de7c1c2b4'
down_revision = '0a144e913bf2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS sub_agency VARCHAR(255)")
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS bd_status VARCHAR(100)")
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS rfp_submission_date TIMESTAMP WITHOUT TIME ZONE")
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS award_date TIMESTAMP WITHOUT TIME ZONE")
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS summary TEXT")
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS history_notes TEXT")
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS next_task_comments TEXT")
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS next_task_due TIMESTAMP WITHOUT TIME ZONE")
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS capture_manager VARCHAR(255)")
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS agency_pocs TEXT")
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS business_sectors TEXT")
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS role VARCHAR(50)")
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS number_of_years INTEGER")


def downgrade() -> None:
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS number_of_years")
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS role")
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS business_sectors")
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS agency_pocs")
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS capture_manager")
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS next_task_due")
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS next_task_comments")
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS history_notes")
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS summary")
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS award_date")
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS rfp_submission_date")
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS bd_status")
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS sub_agency")
