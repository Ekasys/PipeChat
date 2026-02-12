"""Script to populate OpenAI provider from environment variables"""
import asyncio
import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, text
from app.config import settings
from app.models.ai_provider import AIProvider
import uuid
from datetime import datetime
import json


async def populate_openai_provider():
    """Populate OpenAI provider for all tenants"""
    # Ensure we're using asyncpg
    db_url = settings.DATABASE_URL
    if 'postgresql://' in db_url and '+asyncpg' not in db_url:
        db_url = db_url.replace('postgresql://', 'postgresql+asyncpg://')
    elif 'postgresql+psycopg2' in db_url:
        db_url = db_url.replace('postgresql+psycopg2', 'postgresql+asyncpg')
    
    engine = create_async_engine(db_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    openai_api_key = os.getenv('OPENAI_API_KEY') or settings.OPENAI_API_KEY
    openai_model = os.getenv('OPENAI_MODEL', 'gpt-5-mini') or settings.OPENAI_MODEL
    
    if not openai_api_key:
        print("WARNING: OPENAI_API_KEY not set. Skipping provider population.")
        return
    
    async with async_session() as session:
        # Get all tenants
        result = await session.execute(text("SELECT id FROM tenants"))
        tenants = result.fetchall()
        
        if not tenants:
            print("No tenants found. Skipping provider population.")
            return
        
        for tenant_row in tenants:
            tenant_id = tenant_row[0]
            
            # Check if provider already exists for this tenant
            existing = await session.execute(
                select(AIProvider).where(
                    AIProvider.tenant_id == tenant_id,
                    AIProvider.provider_name == 'chatgpt'
                )
            )
            if existing.scalar_one_or_none():
                print(f"OpenAI provider already exists for tenant {tenant_id}. Skipping.")
                continue
            
            # Create new provider
            provider = AIProvider(
                id=str(uuid.uuid4()),
                tenant_id=tenant_id,
                provider_name='chatgpt',
                display_name='OpenAI ChatGPT',
                is_active=True,
                is_default=True,
                connection_config={
                    "api_key": openai_api_key,
                    "api_endpoint": "https://api.openai.com/v1",
                    "default_model": openai_model,
                    "temperature": 0.7,
                    "max_tokens": 2000,
                },
            )
            
            # Unset other defaults for this tenant
            await session.execute(
                text("UPDATE ai_providers SET is_default = false WHERE tenant_id = :tenant_id"),
                {"tenant_id": tenant_id}
            )
            
            session.add(provider)
            await session.commit()
            print(f"Created OpenAI provider for tenant {tenant_id}")
    
    await engine.dispose()
    print("Done!")


if __name__ == "__main__":
    asyncio.run(populate_openai_provider())

