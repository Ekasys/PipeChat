import psycopg2

conn = psycopg2.connect(
    host='localhost',
    port=5432,
    user='postgres',
    password='postgres',
    database='pipelinepro'
)
cur = conn.cursor()

# Add missing columns to market_intel
columns = [
    'ALTER TABLE market_intel ADD COLUMN IF NOT EXISTS place_of_performance VARCHAR(500)',
    'ALTER TABLE market_intel ADD COLUMN IF NOT EXISTS contract_type VARCHAR(100)',
    'ALTER TABLE market_intel ADD COLUMN IF NOT EXISTS period_of_performance VARCHAR(255)',
    'ALTER TABLE market_intel ADD COLUMN IF NOT EXISTS sam_gov_url VARCHAR(500)',
    'ALTER TABLE market_intel ADD COLUMN IF NOT EXISTS attachments JSON',
    'ALTER TABLE market_intel ADD COLUMN IF NOT EXISTS attachments_fetched BOOLEAN DEFAULT FALSE',
    'ALTER TABLE market_intel ADD COLUMN IF NOT EXISTS compliance_summary JSON',
    'ALTER TABLE market_intel ADD COLUMN IF NOT EXISTS bid_decision VARCHAR(20)',
    'ALTER TABLE market_intel ADD COLUMN IF NOT EXISTS bid_decision_date TIMESTAMP',
    'ALTER TABLE market_intel ADD COLUMN IF NOT EXISTS bid_decision_rationale TEXT',
    'ALTER TABLE market_intel ADD COLUMN IF NOT EXISTS bid_score NUMERIC(5,2)',
    'ALTER TABLE market_intel ADD COLUMN IF NOT EXISTS bid_criteria_scores JSON',
    'ALTER TABLE market_intel ADD COLUMN IF NOT EXISTS converted_to_opportunity_id VARCHAR',
    'ALTER TABLE market_intel ADD COLUMN IF NOT EXISTS converted_at TIMESTAMP',
]

for col in columns:
    print(f'Running: {col}')
    cur.execute(col)

# Update alembic_version to show migration as complete
cur.execute("UPDATE alembic_version SET version_num = '003_capture_qual'")

conn.commit()
cur.close()
conn.close()
print('Done!')
