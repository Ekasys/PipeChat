"""Test keyword parameter for SAM.gov API"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.integrations.sam_gov import search_opportunities
from app.config import settings
import httpx
import json

async def test_keyword_params():
    """Test different keyword parameter names"""
    api_key = settings.SAM_GOV_API_KEY
    base_url = "https://api.sam.gov"
    
    # Test with "keyword" (singular)
    print("Testing with 'keyword' parameter...")
    params1 = {
        "api_key": api_key,
        "keyword": "Cyber Security",
        "postedFrom": "08/11/2025",
        "postedTo": "11/09/2025",
        "limit": 5
    }
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        response1 = await client.get(
            f"{base_url}/opportunities/v2/search",
            params=params1,
            headers={"Accept": "application/json"}
        )
        print(f"Status: {response1.status_code}")
        if response1.status_code == 200:
            data1 = response1.json()
            results1 = data1.get("results", [])
            print(f"Results with 'keyword': {len(results1)}")
            if results1:
                print(f"First title: {results1[0].get('title', 'N/A')}")
        else:
            print(f"Error: {response1.text[:200]}")
    
    # Test with "keywords" (plural)
    print("\nTesting with 'keywords' parameter...")
    params2 = {
        "api_key": api_key,
        "keywords": "Cyber Security",
        "postedFrom": "08/11/2025",
        "postedTo": "11/09/2025",
        "limit": 5
    }
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        response2 = await client.get(
            f"{base_url}/opportunities/v2/search",
            params=params2,
            headers={"Accept": "application/json"}
        )
        print(f"Status: {response2.status_code}")
        if response2.status_code == 200:
            data2 = response2.json()
            results2 = data2.get("results", [])
            print(f"Results with 'keywords': {len(results2)}")
            if results2:
                print(f"First title: {results2[0].get('title', 'N/A')}")
        else:
            print(f"Error: {response2.text[:200]}")
    
    # Test with "q" parameter
    print("\nTesting with 'q' parameter...")
    params3 = {
        "api_key": api_key,
        "q": "Cyber Security",
        "postedFrom": "08/11/2025",
        "postedTo": "11/09/2025",
        "limit": 5
    }
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        response3 = await client.get(
            f"{base_url}/opportunities/v2/search",
            params=params3,
            headers={"Accept": "application/json"}
        )
        print(f"Status: {response3.status_code}")
        if response3.status_code == 200:
            data3 = response3.json()
            results3 = data3.get("results", [])
            print(f"Results with 'q': {len(results3)}")
            if results3:
                print(f"First title: {results3[0].get('title', 'N/A')}")
        else:
            print(f"Error: {response3.text[:200]}")

if __name__ == "__main__":
    asyncio.run(test_keyword_params())

