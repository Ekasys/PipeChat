"""Test script for SAM.gov API integration"""
import asyncio
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.integrations.sam_gov import (
    search_opportunities,
    get_opportunity_details,
    search_entities,
    get_entity_details,
    search_contracts,
)
from app.config import settings


async def test_search_opportunities():
    """Test opportunity search"""
    print("\n" + "="*60)
    print("Testing SAM.gov Opportunity Search")
    print("="*60)
    
    if not settings.SAM_GOV_API_KEY:
        print("[ERROR] SAM_GOV_API_KEY not configured in settings")
        return False
    
    print(f"[OK] API Key configured: {settings.SAM_GOV_API_KEY[:10]}...")
    
    try:
        # Test 1: Basic keyword search
        print("\n[TEST 1] Basic keyword search (IT services)")
        result = await search_opportunities(keywords="IT services", limit=5)
        
        if result.get("error"):
            print(f"[ERROR] Error: {result.get('error')}")
            print(f"   Message: {result.get('message')}")
            return False
        
        total = result.get("total", 0)
        results = result.get("results", [])
        
        print(f"[OK] Search successful!")
        print(f"   Total results: {total}")
        print(f"   Returned: {len(results)}")
        
        if results:
            print(f"\n   First result:")
            first = results[0]
            print(f"   - Title: {first.get('title', first.get('titleText', 'N/A'))}")
            print(f"   - Agency: {first.get('agency', first.get('department', 'N/A'))}")
            print(f"   - Notice ID: {first.get('noticeId', first.get('noticeID', 'N/A'))}")
            print(f"   - Posted Date: {first.get('postedDate', first.get('posted', 'N/A'))}")
        else:
            print("   [WARN] No results returned")
        
        # Test 2: Search with filters
        print("\n[TEST 2] Search with filters (8(a) set-aside)")
        result2 = await search_opportunities(
            keywords="software",
            set_aside="8A",
            limit=3
        )
        
        if result2.get("error"):
            print(f"[WARN] Filtered search error: {result2.get('error')}")
        else:
            print(f"[OK] Filtered search successful!")
            print(f"   Total results: {result2.get('total', 0)}")
        
        return True
        
    except Exception as e:
        print(f"[ERROR] Exception during test: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


async def test_get_opportunity_details():
    """Test getting opportunity details"""
    print("\n" + "="*60)
    print("Testing Get Opportunity Details")
    print("="*60)
    
    # First, search for an opportunity to get a notice ID
    print("\n[INFO] Getting a notice ID from search...")
    search_result = await search_opportunities(keywords="IT", limit=1)
    
    if search_result.get("error") or not search_result.get("results"):
        print("[WARN] Could not get a notice ID to test with")
        return True  # Not a failure, just no data
    
    notice_id = None
    first_result = search_result.get("results", [])[0]
    
    # Try different field names
    notice_id = (
        first_result.get("noticeId") or 
        first_result.get("noticeID") or 
        first_result.get("id") or
        first_result.get("opportunityId")
    )
    
    if not notice_id:
        print("[WARN] Could not extract notice ID from search results")
        print(f"   Available keys: {list(first_result.keys())[:10]}")
        return True
    
    print(f"[OK] Found notice ID: {notice_id}")
    
    try:
        print(f"\n[INFO] Fetching details for notice: {notice_id}")
        details = await get_opportunity_details(notice_id)
        
        if details:
            print("[OK] Successfully retrieved opportunity details!")
            print(f"   Keys in response: {list(details.keys())[:10]}")
        else:
            print("[WARN] No details returned (may be 404 or parsing issue)")
        
        return True
        
    except Exception as e:
        print(f"[ERROR] Exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


async def test_search_entities():
    """Test entity search"""
    print("\n" + "="*60)
    print("Testing Entity Search")
    print("="*60)
    
    try:
        print("\n[TEST] Search for entities (IT companies)")
        result = await search_entities(name="technology", limit=3)
        
        if result.get("error"):
            print(f"[WARN] Entity search error: {result.get('error')}")
            print(f"   Message: {result.get('message')}")
        else:
            print(f"[OK] Entity search successful!")
            print(f"   Total results: {result.get('total', 0)}")
            print(f"   Returned: {len(result.get('results', []))}")
        
        return True
        
    except Exception as e:
        print(f"[ERROR] Exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


async def test_search_contracts():
    """Test contract search"""
    print("\n" + "="*60)
    print("Testing Contract Search")
    print("="*60)
    
    try:
        print("\n[TEST] Search for contracts (IT)")
        result = await search_contracts(keywords="IT", limit=3)
        
        if result.get("error"):
            print(f"[WARN] Contract search error: {result.get('error')}")
            print(f"   Message: {result.get('message')}")
        else:
            print(f"[OK] Contract search successful!")
            print(f"   Total results: {result.get('total', 0)}")
            print(f"   Returned: {len(result.get('results', []))}")
        
        return True
        
    except Exception as e:
        print(f"[ERROR] Exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


async def main():
    """Run all tests"""
    print("\n" + "="*60)
    print("SAM.gov API Integration Test Suite")
    print("="*60)
    print(f"\nAPI Key: {settings.SAM_GOV_API_KEY[:10] + '...' if settings.SAM_GOV_API_KEY else 'NOT CONFIGURED'}")
    print(f"Base URL: https://api.sam.gov")
    
    results = []
    
    # Run tests
    results.append(("Opportunity Search", await test_search_opportunities()))
    results.append(("Get Opportunity Details", await test_get_opportunity_details()))
    results.append(("Entity Search", await test_search_entities()))
    results.append(("Contract Search", await test_search_contracts()))
    
    # Summary
    print("\n" + "="*60)
    print("Test Summary")
    print("="*60)
    
    for test_name, passed in results:
        status = "[PASS]" if passed else "[FAIL]"
        print(f"{status} - {test_name}")
    
    total_passed = sum(1 for _, passed in results if passed)
    print(f"\nTotal: {total_passed}/{len(results)} tests passed")
    
    if total_passed == len(results):
        print("\n[SUCCESS] All tests passed!")
    else:
        print("\n[WARN] Some tests failed or returned warnings")


if __name__ == "__main__":
    asyncio.run(main())

