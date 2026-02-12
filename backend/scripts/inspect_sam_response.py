"""Inspect SAM.gov response structure"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.integrations.sam_gov import search_opportunities
import json

async def inspect():
    print("Fetching sample results to inspect structure...")
    result = await search_opportunities(limit=3)
    
    if result.get('results'):
        print("\n" + "="*60)
        print("Sample Result Structure:")
        print("="*60)
        sample = result['results'][0]
        print(json.dumps(sample, indent=2, default=str))
        
        print("\n" + "="*60)
        print("Key Fields for Filtering:")
        print("="*60)
        print(f"type: {sample.get('type')}")
        print(f"baseType: {sample.get('baseType')}")
        print(f"typeOfSetAside: {sample.get('typeOfSetAside')}")
        print(f"typeOfSetAsideDescription: {sample.get('typeOfSetAsideDescription')}")
        print(f"naicsCode: {sample.get('naicsCode')}")
        print(f"naicsCodes: {sample.get('naicsCodes')}")
        print(f"postedDate: {sample.get('postedDate')}")

if __name__ == "__main__":
    asyncio.run(inspect())

