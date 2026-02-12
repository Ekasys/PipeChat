"""Add capture qualification models - compliance matrix, bid/no-bid

Revision ID: 003_capture_qual
Revises:
Create Date: 2026-01-29

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = '003_capture_qual'
down_revision = 'c7e9fc2fa58d'
branch_labels = None
depends_on = None


MARKET_INTEL_COLUMNS = [
    ("place_of_performance", "VARCHAR(500)"),
    ("contract_type", "VARCHAR(100)"),
    ("period_of_performance", "VARCHAR(255)"),
    ("sam_gov_url", "VARCHAR(500)"),
    ("attachments", "JSON"),
    ("attachments_fetched", "BOOLEAN"),
    ("compliance_summary", "JSON"),
    ("bid_decision", "VARCHAR(20)"),
    ("bid_decision_date", "TIMESTAMP WITHOUT TIME ZONE"),
    ("bid_decision_rationale", "TEXT"),
    ("bid_score", "NUMERIC(5,2)"),
    ("bid_criteria_scores", "JSON"),
    ("converted_to_opportunity_id", "VARCHAR"),
    ("converted_at", "TIMESTAMP WITHOUT TIME ZONE"),
]


def upgrade() -> None:
    for name, pg_type in MARKET_INTEL_COLUMNS:
        op.execute(f"ALTER TABLE market_intel ADD COLUMN IF NOT EXISTS {name} {pg_type}")

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS compliance_requirements (
            id VARCHAR PRIMARY KEY,
            market_intel_id VARCHAR NOT NULL REFERENCES market_intel(id),
            requirement_number VARCHAR(50),
            section VARCHAR(255),
            requirement_text TEXT NOT NULL,
            requirement_type VARCHAR(50),
            compliance_status VARCHAR(20),
            compliance_notes TEXT,
            gap_description TEXT,
            mitigation_plan TEXT,
            response_approach TEXT,
            evidence_references JSON,
            weight NUMERIC(5,2),
            confidence_score NUMERIC(5,2),
            source_document VARCHAR(255),
            page_reference VARCHAR(50),
            extracted_by_ai BOOLEAN,
            sort_order INTEGER,
            created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
            updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_compliance_requirements_market_intel_id ON compliance_requirements (market_intel_id)")

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS bid_nobid_criteria (
            id VARCHAR PRIMARY KEY,
            tenant_id VARCHAR NOT NULL REFERENCES tenants(id),
            name VARCHAR(255) NOT NULL,
            description TEXT,
            category VARCHAR(100),
            weight NUMERIC(5,2),
            max_score INTEGER,
            minimum_threshold INTEGER,
            scoring_guidance JSON,
            evaluation_questions JSON,
            is_default BOOLEAN,
            sort_order INTEGER,
            is_active BOOLEAN,
            created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
            updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_bid_nobid_criteria_tenant_id ON bid_nobid_criteria (tenant_id)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_bid_nobid_criteria_tenant_id")
    op.execute("DROP TABLE IF EXISTS bid_nobid_criteria")

    op.execute("DROP INDEX IF EXISTS ix_compliance_requirements_market_intel_id")
    op.execute("DROP TABLE IF EXISTS compliance_requirements")

    for name, _ in reversed(MARKET_INTEL_COLUMNS):
        op.execute(f"ALTER TABLE market_intel DROP COLUMN IF EXISTS {name}")
