"""Script to create database if it doesn't exist"""
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

try:
    # Connect to PostgreSQL server
    conn = psycopg2.connect(
        host="localhost",
        port=5432,
        user="postgres",
        password="postgres",
        database="postgres"
    )
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cur = conn.cursor()
    
    # Check if database exists
    cur.execute("SELECT 1 FROM pg_database WHERE datname = 'pipelinepro'")
    exists = cur.fetchone()
    
    if not exists:
        cur.execute("CREATE DATABASE pipelinepro")
        print("Database 'pipelinepro' created successfully")
    else:
        print("Database 'pipelinepro' already exists")
    
    cur.close()
    conn.close()
    
except psycopg2.Error as e:
    print(f"❌ Error: {e}")
    print("\nPlease check:")
    print("  - PostgreSQL is running")
    print("  - Username/password are correct (default: postgres/postgres)")
    print("  - Update the connection details in this script if needed")

