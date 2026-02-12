"""Test simple keyword search"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.integrations.sam_gov import search_opportunities
import json

async def test():
    print("Testing 'IT' search (simple keyword)...")
    result = await search_opportunities(keywords="IT", limit=5)
    
    print(f"\nTotal: {result.get('total', 0)}")
    print(f"Results: {len(result.get('results', []))}")
    
    if result.get('results'):
        print("\nFirst 3 titles:")
        for i, r in enumerate(result['results'][:3], 1):
            title = r.get('title', 'N/A')
            print(f"  {i}. {title}")
    
    print("\n\nTesting 'Cyber Security' search...")
    result2 = await search_opportunities(keywords="Cyber Security", limit=5)
    
    print(f"\nTotal: {result2.get('total', 0)}")
    print(f"Results: {len(result2.get('results', []))}")
    
    if result2.get('results'):
        print("\nFirst 3 titles:")
        for i, r in enumerate(result2['results'][:3], 1):
            title = r.get('title', 'N/A')
            print(f"  {i}. {title}")
    else:
        print("No results for 'Cyber Security'")

if __name__ == "__main__":
    asyncio.run(test())

