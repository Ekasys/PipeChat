"""Test advanced filters for SAM.gov API"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.integrations.sam_gov import search_opportunities
import json

async def test_filters():
    print("="*60)
    print("Testing Advanced Filters")
    print("="*60)
    
    # Test 1: Notice Type filter
    print("\n[TEST 1] Notice Type: PRESOL")
    result1 = await search_opportunities(
        notice_type="PRESOL",
        limit=5
    )
    print(f"Results: {len(result1.get('results', []))}")
    if result1.get('results'):
        print(f"First result type: {result1['results'][0].get('type', 'N/A')}")
        print(f"First result baseType: {result1['results'][0].get('baseType', 'N/A')}")
    
    # Test 2: Set-Aside filter
    print("\n[TEST 2] Set-Aside: 8A")
    result2 = await search_opportunities(
        set_aside="8A",
        limit=5
    )
    print(f"Results: {len(result2.get('results', []))}")
    if result2.get('results'):
        print(f"First result setAside: {result2['results'][0].get('typeOfSetAside', 'N/A')}")
    
    # Test 3: Date range
    print("\n[TEST 3] Custom Date Range (last 30 days)")
    from datetime import datetime, timedelta
    posted_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    posted_to = datetime.now().strftime("%Y-%m-%d")
    result3 = await search_opportunities(
        posted_from=posted_from,
        posted_to=posted_to,
        limit=5
    )
    print(f"Results: {len(result3.get('results', []))}")
    if result3.get('results'):
        print(f"First result postedDate: {result3['results'][0].get('postedDate', 'N/A')}")
    
    # Test 4: NAICS code
    print("\n[TEST 4] NAICS Code: 541511 (IT Services)")
    result4 = await search_opportunities(
        naics_code="541511",
        limit=5
    )
    print(f"Results: {len(result4.get('results', []))}")
    if result4.get('results'):
        print(f"First result naicsCode: {result4['results'][0].get('naicsCode', 'N/A')}")
        print(f"First result naicsCodes: {result4['results'][0].get('naicsCodes', 'N/A')}")
    
    # Test 5: Combined filters
    print("\n[TEST 5] Combined: 8A + PRESOL")
    result5 = await search_opportunities(
        notice_type="PRESOL",
        set_aside="8A",
        limit=5
    )
    print(f"Results: {len(result5.get('results', []))}")
    if result5.get('results'):
        r = result5['results'][0]
        print(f"First result - Type: {r.get('type', 'N/A')}, SetAside: {r.get('typeOfSetAside', 'N/A')}")

if __name__ == "__main__":
    asyncio.run(test_filters())

