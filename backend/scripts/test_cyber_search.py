"""Quick test for Cyber Security search"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.integrations.sam_gov import search_opportunities
from app.config import settings
import json

async def test():
    print("Testing 'Cyber Security' search...")
    print(f"API Key: {settings.SAM_GOV_API_KEY[:15]}...")
    
    result = await search_opportunities(keywords="Cyber Security", limit=10)
    
    print("\n" + "="*60)
    print("RESULT:")
    print("="*60)
    print(json.dumps(result, indent=2, default=str))
    
    if result.get("results"):
        print(f"\nFound {len(result['results'])} results")
        print("\nFirst result keys:", list(result['results'][0].keys())[:10])
    else:
        print("\nNo results found")
        if result.get("error"):
            print(f"Error: {result.get('error')}")
            print(f"Message: {result.get('message')}")

if __name__ == "__main__":
    asyncio.run(test())

