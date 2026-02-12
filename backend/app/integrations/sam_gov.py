"""SAM.gov API integration"""
from typing import Optional, Dict, Any
from app.config import settings
import httpx
import xml.etree.ElementTree as ET
import json
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


# Base URL for SAM.gov API
SAM_GOV_BASE_URL = "https://api.sam.gov"


def extract_department(full_parent_path: str) -> str:
    """
    Extract top-level department from fullParentPathName.
    
    Example: "DEPT OF DEFENSE.DEPT OF THE NAVY.NAVSUP..." -> "DEPT OF DEFENSE"
    """
    if not full_parent_path:
        return ""
    return full_parent_path.split(".")[0].strip()


async def fetch_opportunity_description(notice_id: str) -> Optional[str]:
    """
    Fetch the actual description text for an opportunity.
    The search API returns a URL in the 'description' field that must be fetched separately.
    
    Args:
        notice_id: The notice ID (UUID)
    
    Returns:
        Description text or None if fetch fails
    """
    if not settings.SAM_GOV_API_KEY:
        return None
    
    try:
        url = f"{SAM_GOV_BASE_URL}/prod/opportunities/v1/noticedesc"
        params = {
            "noticeid": notice_id,
            "api_key": settings.SAM_GOV_API_KEY,
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            
            data = response.json()
            return data.get("description", "")
    except Exception as e:
        logger.error(f"Failed to fetch description for notice {notice_id}: {e}")
        return None


async def search_opportunities(
    keywords: Optional[str] = None,
    notice_type: Optional[str] = None,
    posted_from: Optional[str] = None,
    posted_to: Optional[str] = None,
    set_aside: Optional[str] = None,
    naics_code: Optional[str] = None,
    limit: int = 10,
    offset: int = 0,
) -> Dict[str, Any]:
    """
    Search SAM.gov for contract opportunities
    
    Note: If keywords are provided, we fetch more results (up to 1000) 
    and filter client-side, as SAM.gov API may not support keyword filtering.
    
    Args:
        keywords: Search keywords
        notice_type: Type of notice (e.g., 'PRESOL', 'COMBINE', 'SRCSGT', 'SNOTE', 'SSALE', 'AWARD')
        posted_from: Start date (YYYY-MM-DD)
        posted_to: End date (YYYY-MM-DD)
        set_aside: Set-aside type (e.g., 'SBA', '8A', 'HUBZone', 'WOSB', 'EDWOSB', 'VOSB', 'SDVOSB')
        naics_code: NAICS code
        limit: Maximum number of results to return (1-1000). If keywords provided, fetches more and filters.
        offset: Pagination offset
    
    Returns:
        Dictionary with search results
    """
    if not settings.SAM_GOV_API_KEY:
        return {
            "results": [],
            "total": 0,
            "message": "SAM.gov API key not configured.",
        }
    
    try:
        # If keywords are provided, fetch more results to increase chances of matches
        # We'll filter client-side since API keyword filtering may not work
        fetch_limit = min(limit * 20, 1000) if keywords else min(limit, 1000)
        
        params = {
            "api_key": settings.SAM_GOV_API_KEY,
            "limit": fetch_limit,
            "offset": offset,
        }
        
        # SAM.gov API requires PostedFrom and PostedTo dates in MM/dd/yyyy format
        # Default to last 90 days if not provided or empty
        if not posted_from or (isinstance(posted_from, str) and posted_from.strip() == ""):
            posted_from = (datetime.now() - timedelta(days=90)).strftime("%m/%d/%Y")
        else:
            # Convert YYYY-MM-DD to MM/dd/yyyy if needed
            try:
                if "-" in str(posted_from):
                    dt = datetime.strptime(str(posted_from), "%Y-%m-%d")
                    posted_from = dt.strftime("%m/%d/%Y")
            except:
                pass  # Use as-is if conversion fails
        
        if not posted_to or (isinstance(posted_to, str) and posted_to.strip() == ""):
            posted_to = datetime.now().strftime("%m/%d/%Y")
        else:
            # Convert YYYY-MM-DD to MM/dd/yyyy if needed
            try:
                if "-" in str(posted_to):
                    dt = datetime.strptime(str(posted_to), "%Y-%m-%d")
                    posted_to = dt.strftime("%m/%d/%Y")
            except:
                pass  # Use as-is if conversion fails
        
        params["postedFrom"] = posted_from
        params["postedTo"] = posted_to
        
        # SAM.gov API v2 - try both "q" and "keyword" parameters
        # Based on testing, the API may not support keyword filtering directly
        # We'll try "q" first, and if that doesn't work, we may need to filter client-side
        if keywords:
            # SAM.gov v2 uses 'title' for keyword search in opportunity titles
            params["title"] = keywords
            logger.info(f"Searching with keyword: {keywords}")
        if notice_type:
            # SAM.gov v2 uses 'ptype' for notice type
            # o=Solicitation, k=Combined, r=Sources Sought, p=Presolicitation, etc.
            ptype_map = {
                'PRESOL': 'p',
                'COMBINE': 'k', 
                'SRCSGT': 'r',
                'SNOTE': 's',
                'SSALE': 'u',
                'AWARD': 'a',
            }
            params["ptype"] = ptype_map.get(notice_type.upper(), notice_type.lower())
        if set_aside:
            # SAM.gov v2 uses 'typeOfSetAside'
            params["typeOfSetAside"] = set_aside
        if naics_code:
            # SAM.gov v2 uses 'ncode' for NAICS code
            params["ncode"] = naics_code
        
        logger.info(f"SAM.gov API request params: {list(params.keys())}")
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            # Request JSON format explicitly
            headers = {"Accept": "application/json"}
            response = await client.get(
                f"{SAM_GOV_BASE_URL}/opportunities/v2/search",
                params=params,
                headers=headers,
            )
            response.raise_for_status()
            
            # Try to parse as JSON first
            content_type = response.headers.get("content-type", "").lower()
            if "json" in content_type or response.text.strip().startswith("{"):
                try:
                    data = response.json()
                except json.JSONDecodeError:
                    logger.warning("Failed to parse JSON response, trying XML")
                    data = None
            else:
                data = None
            
            # If JSON parsing failed, try XML
            if data is None:
                try:
                    root = ET.fromstring(response.text)
                    data = parse_xml_opportunities(root)
                except ET.ParseError as e:
                    logger.error(f"Failed to parse XML response: {e}")
                    return {
                        "results": [],
                        "total": 0,
                        "error": "Failed to parse SAM.gov API response",
                        "message": "SAM.gov API returned invalid response format.",
                    }
            
            # Normalize response format - handle different response structures
            if isinstance(data, dict):
                # JSON response - check multiple possible keys
                # SAM.gov API v2 returns results directly in "results" key or nested
                results = (
                    data.get("results") or  # Direct results key
                    data.get("opportunitiesData") or  # Nested opportunitiesData
                    data.get("opportunityData") or  # Alternative nested key
                    data.get("data") or  # Generic data key
                    []  # Default to empty list
                )
                # Ensure results is a list
                if not isinstance(results, list):
                    results = []
                
                total = (
                    data.get("total") or  # Direct total key
                    data.get("totalRecords") or  # Alternative total key
                    len(results)  # Fallback to length of results
                )
            elif isinstance(data, list):
                # Direct list response
                results = data
                total = len(results)
            else:
                results = []
                total = 0
            
            # Log for debugging
            logger.info(f"SAM.gov search returned {len(results)} results out of {total} total")
            
            # Apply client-side filtering for keywords and other filters
            # (SAM.gov API filters may not work as expected, so we filter client-side)
            filtered_results = results if isinstance(results, list) else []
            
            # Debug logging
            logger.info(f"Filters - Keyword: {repr(keywords)}, NoticeType: {notice_type}, SetAside: {set_aside}, NAICS: {naics_code}")
            logger.info(f"Results before filtering: {len(filtered_results)}")
            
            # Ensure keywords is a string and not empty
            if keywords:
                keywords = str(keywords).strip()
            
            # Apply all filters client-side
            if filtered_results:
                original_count = len(filtered_results)
                
                # Filter by notice type
                # Map common notice types to what SAM.gov actually returns
                notice_type_map = {
                    "PRESOL": ["PRESOL", "PRESOLICITATION", "PRE-SOLICITATION"],
                    "COMBINE": ["COMBINE", "COMBINED", "SYNOPSIS/SOLICITATION", "COMBINED SYNOPSIS"],
                    "SRCSGT": ["SRCSGT", "SOURCES SOUGHT", "SOURCES"],
                    "SNOTE": ["SNOTE", "SPECIAL NOTICE", "SPECIAL"],
                    "SSALE": ["SSALE", "SALE", "SURPLUS"],
                    "AWARD": ["AWARD", "AWARD NOTICE"],
                }
                
                if notice_type:
                    notice_upper = notice_type.upper()
                    # Get possible values for this notice type
                    possible_values = notice_type_map.get(notice_upper, [notice_upper])
                    
                    filtered_results = [
                        r for r in filtered_results
                        if any(
                            val in str(r.get("type", "")).upper() or
                            val in str(r.get("baseType", "")).upper() or
                            val in str(r.get("noticeType", "")).upper()
                            for val in possible_values
                        )
                    ]
                    logger.info(f"After notice_type filter '{notice_type}': {len(filtered_results)} results")
                
                # Filter by set-aside
                # Map common set-aside codes to descriptions
                set_aside_map = {
                    "8A": ["8A", "8(A)", "8(A) PROGRAM"],
                    "SBA": ["SBA", "SMALL BUSINESS"],
                    "HUBZONE": ["HUBZONE", "HUBZONE", "HUB ZONE"],
                    "WOSB": ["WOSB", "WOMAN-OWNED", "WOMEN-OWNED"],
                    "EDWOSB": ["EDWOSB", "ECONOMICALLY DISADVANTAGED"],
                    "VOSB": ["VOSB", "VETERAN-OWNED"],
                    "SDVOSB": ["SDVOSB", "SERVICE-DISABLED"],
                }
                
                if set_aside:
                    set_aside_upper = set_aside.upper()
                    # Get possible values for this set-aside
                    possible_values = set_aside_map.get(set_aside_upper, [set_aside_upper])
                    
                    filtered_results = [
                        r for r in filtered_results
                        if any(
                            val in str(r.get("typeOfSetAside", "")).upper() or
                            val in str(r.get("typeOfSetAsideDescription", "")).upper() or
                            val in str(r.get("setAside", "")).upper()
                            for val in possible_values
                        )
                    ]
                    logger.info(f"After set_aside filter '{set_aside}': {len(filtered_results)} results")
                
                # Filter by NAICS code
                if naics_code:
                    naics_str = str(naics_code).strip()
                    filtered_results = [
                        r for r in filtered_results
                        if (
                            naics_str in str(r.get("naicsCode", "")) or
                            naics_str in str(r.get("naicsCodes", [])) or
                            any(naics_str in str(code) for code in (r.get("naicsCodes", []) or []))
                        )
                    ]
                    logger.info(f"After naics_code filter '{naics_code}': {len(filtered_results)} results")
                
                # Filter by keywords
                if keywords and keywords != "":
                    keyword_lower = keywords.lower().strip()
                    logger.info(f"Filtering with keyword (lowercase): '{keyword_lower}'")
                    
                    # Split multi-word keywords - match if ANY word appears (OR logic)
                    # For exact phrase matching, also check the full keyword
                    keyword_parts = keyword_lower.split()
                    
                    filtered_results = [
                        r for r in filtered_results
                        if (
                            # Check for full phrase match first
                            keyword_lower in str(r.get("title", "")).lower() or
                            keyword_lower in str(r.get("solicitationNumber", "")).lower() or
                            keyword_lower in str(r.get("fullParentPathName", "")).lower() or
                            # Check for individual word matches (any word)
                            any(
                                part in str(r.get("title", "")).lower() or
                                part in str(r.get("solicitationNumber", "")).lower() or
                                part in str(r.get("fullParentPathName", "")).lower() or
                                part in str(r.get("type", "")).lower() or
                                part in str(r.get("baseType", "")).lower() or
                                part in str(r.get("typeOfSetAsideDescription", "")).lower()
                                for part in keyword_parts
                            )
                        )
                    ]
                    logger.info(f"After keyword filtering '{keywords}': {len(filtered_results)} results")
                
                logger.info(f"Total filtering: {original_count} -> {len(filtered_results)} results")
                
                # Log first few filtered result titles for debugging
                if filtered_results:
                    logger.info(f"Sample filtered titles: {[r.get('title', 'N/A')[:50] for r in filtered_results[:3]]}")
                elif original_count > 0:
                    logger.warning(f"All {original_count} results were filtered out")
                    logger.warning(f"Sample original titles: {[r.get('title', 'N/A')[:50] for r in results[:5]]}")
            
            # Apply limit to filtered results
            if limit and len(filtered_results) > limit:
                filtered_results = filtered_results[:limit]
            
            # Enrich results with parsed department
            for r in filtered_results:
                r["department"] = extract_department(r.get("fullParentPathName", ""))
            
            return {
                "results": filtered_results,
                "total": len(filtered_results) if keywords else total,  # Update total if filtered
                "offset": offset,
                "limit": len(filtered_results),
            }
    except httpx.HTTPStatusError as e:
        error_text = e.response.text[:500] if e.response.text else "No error details"
        logger.error(f"SAM.gov API HTTP error {e.response.status_code}: {error_text}")
        
        # Handle rate limiting
        if e.response.status_code == 429:
            return {
                "results": [],
                "total": 0,
                "error": "Rate limit exceeded",
                "message": "SAM.gov API rate limit exceeded. Please try again later.",
            }
        
        # Handle 400 - Bad Request (missing required parameters)
        if e.response.status_code == 400:
            try:
                error_data = e.response.json()
                error_msg = error_data.get("errorMessage", error_text)
                if "PostedFrom" in error_msg or "PostedTo" in error_msg or "mandatory" in error_msg.lower():
                    return {
                        "results": [],
                        "total": 0,
                        "error": "Missing required parameters",
                        "message": "SAM.gov API requires PostedFrom and PostedTo dates. These have been set to default values (last 90 days). Please try again.",
                    }
            except:
                pass
        
        # Handle suspended endpoint
        if e.response.status_code == 500:
            try:
                error_data = e.response.json()
                if "SUSPENDED" in error_text or "suspended" in error_text.lower():
                    return {
                        "results": [],
                        "total": 0,
                        "error": "Endpoint suspended",
                        "message": "The SAM.gov API endpoint is currently suspended or unavailable. This is a temporary SAM.gov infrastructure issue. Please try again later or check the SAM.gov status page.",
                    }
            except:
                pass
        
        return {
            "results": [],
            "total": 0,
            "error": f"HTTP {e.response.status_code}: {error_text}",
            "message": "SAM.gov API error.",
        }
    except httpx.TimeoutException:
        logger.error("SAM.gov API request timed out")
        return {
            "results": [],
            "total": 0,
            "error": "Request timeout",
            "message": "SAM.gov API request timed out. Please try again.",
        }
    except Exception as e:
        logger.error(f"SAM.gov API error: {str(e)}", exc_info=True)
        return {
            "results": [],
            "total": 0,
            "error": str(e),
            "message": "SAM.gov API error.",
        }


def parse_xml_opportunities(root: ET.Element) -> Dict[str, Any]:
    """Parse XML response from SAM.gov API"""
    opportunities = []
    
    # Handle different XML structures
    for opp in root.findall(".//opportunity") or root.findall(".//opportunityData"):
        opp_data = {}
        for child in opp:
            tag = child.tag.replace("{http://www.sam.gov/}", "")
            text = child.text if child.text else ""
            
            # Handle nested elements
            if len(child) > 0:
                opp_data[tag] = {subchild.tag.replace("{http://www.sam.gov/}", ""): subchild.text for subchild in child}
            else:
                opp_data[tag] = text
        
        if opp_data:
            opportunities.append(opp_data)
    
    return {
        "opportunitiesData": opportunities,
        "totalRecords": len(opportunities),
    }


async def get_opportunity_details(notice_id: str) -> Optional[Dict[str, Any]]:
    """
    Get detailed information for a specific SAM.gov opportunity
    
    Args:
        notice_id: The notice ID (UUID format like 'b3879cdba0d9450b99bef8ee483db52b')
    
    Returns:
        Dictionary with opportunity details or None if not found
    """
    if not settings.SAM_GOV_API_KEY:
        return None
    
    try:
        # SAM.gov doesn't have a direct /opportunities/v2/{id} endpoint
        # We need to use the search endpoint with a noticeId filter
        # Search with a wide date range to find the opportunity
        from datetime import datetime, timedelta
        
        today = datetime.now()
        # Search last 2 years to catch most opportunities
        start_date = (today - timedelta(days=730)).strftime("%m/%d/%Y")
        end_date = today.strftime("%m/%d/%Y")
        
        params = {
            "api_key": settings.SAM_GOV_API_KEY,
            "postedFrom": start_date,
            "postedTo": end_date,
            "noticeId": notice_id,
            "limit": 1,
        }
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            headers = {"Accept": "application/json"}
            response = await client.get(
                f"{SAM_GOV_BASE_URL}/opportunities/v2/search",
                params=params,
                headers=headers,
            )
            response.raise_for_status()
            
            # Try JSON first
            content_type = response.headers.get("content-type", "").lower()
            if "json" in content_type or response.text.strip().startswith("{"):
                try:
                    data = response.json()
                    # Extract the first opportunity from results
                    opportunities = data.get("opportunitiesData", [])
                    if opportunities and len(opportunities) > 0:
                        return opportunities[0]
                    
                    logger.warning(f"No opportunity found for notice {notice_id}")
                    return None
                except json.JSONDecodeError:
                    logger.warning(f"Failed to parse JSON for notice {notice_id}, trying XML")
            
            # Try XML
            try:
                root = ET.fromstring(response.text)
                parsed = parse_xml_opportunity_detail(root)
                if parsed:
                    return parsed
            except ET.ParseError:
                logger.error(f"Failed to parse XML for notice {notice_id}")
            
            return None
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return None
        
        # Handle suspended endpoint
        error_text = e.response.text[:500] if e.response.text else ""
        if e.response.status_code == 500 and ("SUSPENDED" in error_text or "suspended" in error_text.lower()):
            logger.warning(f"SAM.gov API endpoint suspended for notice {notice_id}")
            return None
        
        logger.error(f"SAM.gov API error for notice {notice_id}: {e.response.status_code} - {error_text[:200]}")
        return None
    except Exception as e:
        logger.error(f"SAM.gov API error for notice {notice_id}: {str(e)}")
        return None


def parse_xml_opportunity_detail(root: ET.Element) -> Dict[str, Any]:
    """Parse XML response for a single opportunity detail"""
    data = {}
    for child in root:
        tag = child.tag.replace("{http://www.sam.gov/}", "")
        if len(child) > 0:
            data[tag] = {subchild.tag.replace("{http://www.sam.gov/}", ""): subchild.text for subchild in child}
        else:
            data[tag] = child.text if child.text else ""
    return data


async def search_entities(
    name: Optional[str] = None,
    duns: Optional[str] = None,
    cage_code: Optional[str] = None,
    naics_code: Optional[str] = None,
    limit: int = 10,
    offset: int = 0,
) -> Dict[str, Any]:
    """
    Search SAM.gov for registered entities (contractors)
    
    Args:
        name: Entity name
        duns: DUNS number
        cage_code: CAGE code
        naics_code: NAICS code
        limit: Maximum number of results
        offset: Pagination offset
    
    Returns:
        Dictionary with entity search results
    """
    if not settings.SAM_GOV_API_KEY:
        return {
            "results": [],
            "total": 0,
            "message": "SAM.gov API key not configured.",
        }
    
    try:
        # Entity API doesn't support limit/offset parameters directly
        # Use pageSize and page instead, or omit pagination
        params = {
            "api_key": settings.SAM_GOV_API_KEY,
        }
        
        # Add pagination if supported (some endpoints use pageSize/page)
        # For now, we'll omit limit/offset and let the API return default results
        # Client-side limiting can be applied if needed
        
        if name:
            params["legalBusinessName"] = name
        if duns:
            params["ueiSAM"] = duns  # UEI replaced DUNS
        if cage_code:
            params["cageCode"] = cage_code
        if naics_code:
            params["naicsCode"] = naics_code
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            headers = {"Accept": "application/json"}
            response = await client.get(
                f"{SAM_GOV_BASE_URL}/entity-information/v2/entities",
                params=params,
                headers=headers,
            )
            response.raise_for_status()
            
            # Try JSON first
            content_type = response.headers.get("content-type", "").lower()
            if "json" in content_type or response.text.strip().startswith("{"):
                try:
                    data = response.json()
                except json.JSONDecodeError:
                    logger.warning("Failed to parse JSON response for entities, trying XML")
                    data = None
            else:
                data = None
            
            # If JSON parsing failed, try XML
            if data is None:
                try:
                    root = ET.fromstring(response.text)
                    data = parse_xml_entities(root)
                except ET.ParseError as e:
                    logger.error(f"Failed to parse XML response for entities: {e}")
                    return {
                        "results": [],
                        "total": 0,
                        "error": "Failed to parse SAM.gov API response",
                        "message": "SAM.gov API returned invalid response format.",
                    }
            
            results = data.get("entityData", data.get("data", []))
            total = data.get("totalRecords", data.get("total", len(results)))
            
            # Apply client-side limiting if API doesn't support pagination
            limited_results = results if isinstance(results, list) else []
            if limit and len(limited_results) > limit:
                limited_results = limited_results[:limit]
            
            return {
                "results": limited_results,
                "total": total,
                "offset": 0,  # Entity API doesn't support offset
                "limit": len(limited_results),
            }
    except httpx.HTTPStatusError as e:
        error_text = e.response.text[:500] if e.response.text else "No error details"
        
        if e.response.status_code == 429:
            return {
                "results": [],
                "total": 0,
                "error": "Rate limit exceeded",
                "message": "SAM.gov API rate limit exceeded. Please try again later.",
            }
        
        # Handle invalid parameters (400)
        if e.response.status_code == 400:
            if "limit" in error_text.lower() or "offset" in error_text.lower():
                return {
                    "results": [],
                    "total": 0,
                    "error": "Invalid parameters",
                    "message": "The entity search API does not support limit/offset parameters. Please use other search criteria.",
                }
        
        # Handle suspended endpoint
        if e.response.status_code == 500:
            if "SUSPENDED" in error_text or "suspended" in error_text.lower():
                return {
                    "results": [],
                    "total": 0,
                    "error": "Endpoint suspended",
                    "message": "The SAM.gov API endpoint is currently suspended or unavailable. This is a temporary SAM.gov infrastructure issue. Please try again later.",
                }
        
        logger.error(f"SAM.gov API HTTP error for entities: {e.response.status_code}")
        return {
            "results": [],
            "total": 0,
            "error": f"HTTP {e.response.status_code}: {error_text[:200]}",
            "message": "SAM.gov API error.",
        }
    except Exception as e:
        logger.error(f"SAM.gov API error for entities: {str(e)}", exc_info=True)
        return {
            "results": [],
            "total": 0,
            "error": str(e),
            "message": "SAM.gov API error.",
        }


def parse_xml_entities(root: ET.Element) -> Dict[str, Any]:
    """Parse XML response for entity search"""
    entities = []
    for entity in root.findall(".//entity") or root.findall(".//entityData"):
        entity_data = {}
        for child in entity:
            tag = child.tag.replace("{http://www.sam.gov/}", "")
            if len(child) > 0:
                entity_data[tag] = {subchild.tag.replace("{http://www.sam.gov/}", ""): subchild.text for subchild in child}
            else:
                entity_data[tag] = child.text if child.text else ""
        if entity_data:
            entities.append(entity_data)
    return {
        "entityData": entities,
        "totalRecords": len(entities),
    }


async def get_entity_details(uei: str) -> Optional[Dict[str, Any]]:
    """
    Get detailed information for a specific entity
    
    Args:
        uei: Unique Entity Identifier (replaced DUNS)
    
    Returns:
        Dictionary with entity details or None if not found
    """
    if not settings.SAM_GOV_API_KEY:
        return None
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            headers = {"Accept": "application/json"}
            response = await client.get(
                f"{SAM_GOV_BASE_URL}/entity-information/v2/entities/{uei}",
                params={"api_key": settings.SAM_GOV_API_KEY},
                headers=headers,
            )
            response.raise_for_status()
            
            # Try JSON first
            content_type = response.headers.get("content-type", "").lower()
            if "json" in content_type or response.text.strip().startswith("{"):
                try:
                    return response.json()
                except json.JSONDecodeError:
                    logger.warning(f"Failed to parse JSON for entity {uei}, trying XML")
            
            # Try XML
            try:
                root = ET.fromstring(response.text)
                return parse_xml_entity_detail(root)
            except ET.ParseError:
                logger.error(f"Failed to parse XML for entity {uei}")
                return None
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return None
        
        # Handle suspended endpoint
        error_text = e.response.text[:500] if e.response.text else ""
        if e.response.status_code == 500 and ("SUSPENDED" in error_text or "suspended" in error_text.lower()):
            logger.warning(f"SAM.gov API endpoint suspended for entity {uei}")
            return None
        
        logger.error(f"SAM.gov API error for entity {uei}: {e.response.status_code} - {error_text[:200]}")
        return None
    except Exception as e:
        logger.error(f"SAM.gov API error for entity {uei}: {str(e)}")
        return None


def parse_xml_entity_detail(root: ET.Element) -> Dict[str, Any]:
    """Parse XML response for a single entity detail"""
    data = {}
    for child in root:
        tag = child.tag.replace("{http://www.sam.gov/}", "")
        if len(child) > 0:
            data[tag] = {subchild.tag.replace("{http://www.sam.gov/}", ""): subchild.text for subchild in child}
        else:
            data[tag] = child.text if child.text else ""
    return data


async def search_contracts(
    keywords: Optional[str] = None,
    naics_code: Optional[str] = None,
    award_date_from: Optional[str] = None,
    award_date_to: Optional[str] = None,
    limit: int = 10,
    offset: int = 0,
) -> Dict[str, Any]:
    """
    Search SAM.gov for contract award data
    
    Args:
        keywords: Search keywords
        naics_code: NAICS code
        award_date_from: Start date (YYYY-MM-DD)
        award_date_to: End date (YYYY-MM-DD)
        limit: Maximum number of results
        offset: Pagination offset
    
    Returns:
        Dictionary with contract search results
    """
    if not settings.SAM_GOV_API_KEY:
        return {
            "results": [],
            "total": 0,
            "message": "SAM.gov API key not configured.",
        }
    
    try:
        params = {
            "api_key": settings.SAM_GOV_API_KEY,
            "limit": min(limit, 1000),
            "offset": offset,
        }
        
        if keywords:
            params["keyword"] = keywords
        if naics_code:
            params["naicsCode"] = naics_code
        if award_date_from:
            params["awardDateFrom"] = award_date_from
        if award_date_to:
            params["awardDateTo"] = award_date_to
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            headers = {"Accept": "application/json"}
            # Try the correct contracts endpoint path
            # SAM.gov uses /contract-opportunities/v2/contracts or /contracts/v1/search
            response = await client.get(
                f"{SAM_GOV_BASE_URL}/contract-opportunities/v2/contracts",
                params=params,
                headers=headers,
            )
            response.raise_for_status()
            
            # Try JSON first
            content_type = response.headers.get("content-type", "").lower()
            if "json" in content_type or response.text.strip().startswith("{"):
                try:
                    data = response.json()
                except json.JSONDecodeError:
                    logger.warning("Failed to parse JSON response for contracts, trying XML")
                    data = None
            else:
                data = None
            
            # If JSON parsing failed, try XML
            if data is None:
                try:
                    root = ET.fromstring(response.text)
                    data = parse_xml_contracts(root)
                except ET.ParseError as e:
                    logger.error(f"Failed to parse XML response for contracts: {e}")
                    return {
                        "results": [],
                        "total": 0,
                        "error": "Failed to parse SAM.gov API response",
                        "message": "SAM.gov API returned invalid response format.",
                    }
            
            results = data.get("contractData", data.get("data", []))
            total = data.get("totalRecords", data.get("total", len(results)))
            
            return {
                "results": results if isinstance(results, list) else [],
                "total": total,
                "offset": offset,
                "limit": limit,
            }
    except httpx.HTTPStatusError as e:
        error_text = e.response.text[:500] if e.response.text else "No error details"
        
        if e.response.status_code == 429:
            return {
                "results": [],
                "total": 0,
                "error": "Rate limit exceeded",
                "message": "SAM.gov API rate limit exceeded. Please try again later.",
            }
        
        # Handle 404 - endpoint not found
        if e.response.status_code == 404:
            return {
                "results": [],
                "total": 0,
                "error": "Endpoint not found",
                "message": "The contracts endpoint path may be incorrect or the API structure has changed. Please verify the SAM.gov API documentation for the correct endpoint.",
            }
        
        # Handle suspended endpoint
        if e.response.status_code == 500:
            if "SUSPENDED" in error_text or "suspended" in error_text.lower():
                return {
                    "results": [],
                    "total": 0,
                    "error": "Endpoint suspended",
                    "message": "The SAM.gov API endpoint is currently suspended or unavailable. This is a temporary SAM.gov infrastructure issue. Please try again later.",
                }
        
        logger.error(f"SAM.gov API HTTP error for contracts: {e.response.status_code}")
        return {
            "results": [],
            "total": 0,
            "error": f"HTTP {e.response.status_code}: {error_text[:200]}",
            "message": "SAM.gov API error.",
        }
    except Exception as e:
        logger.error(f"SAM.gov API error for contracts: {str(e)}", exc_info=True)
        return {
            "results": [],
            "total": 0,
            "error": str(e),
            "message": "SAM.gov API error.",
        }


def parse_xml_contracts(root: ET.Element) -> Dict[str, Any]:
    """Parse XML response for contract search"""
    contracts = []
    for contract in root.findall(".//contract") or root.findall(".//contractData"):
        contract_data = {}
        for child in contract:
            tag = child.tag.replace("{http://www.sam.gov/}", "")
            if len(child) > 0:
                contract_data[tag] = {subchild.tag.replace("{http://www.sam.gov/}", ""): subchild.text for subchild in child}
            else:
                contract_data[tag] = child.text if child.text else ""
        if contract_data:
            contracts.append(contract_data)
    return {
        "contractData": contracts,
        "totalRecords": len(contracts),
    }


# Backward compatibility aliases
async def search_sam_gov(keywords: str, limit: int = 10) -> Dict[str, Any]:
    """Backward compatibility wrapper for search_opportunities"""
    return await search_opportunities(keywords=keywords, limit=limit)

