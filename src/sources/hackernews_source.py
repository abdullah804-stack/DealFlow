# src/sources/hackernews_source.py
"""
Hacker News Source — Scrape "Show HN" posts for startup candidates.

Uses the official Hacker News Firebase API (free, no key required).
Fetches recent "Show HN" posts and extracts startup information.

Show HN posts are ideal candidates because founders actively showcase
their products to the HN community.
"""

import logging
import time
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import requests

# Hacker News API endpoints
HN_BASE_URL = "https://hacker-news.firebaseio.com/v0"
HN_TOP_STORIES_URL = f"{HN_BASE_URL}/topstories.json"
HN_ITEM_URL = f"{HN_BASE_URL}/item/{{}}.json"

# How many top stories to check for Show HN posts
MAX_STORIES_TO_CHECK = 100

# How far back to look for Show HN posts (in hours)
MAX_HOURS_BACK = 48

logger = logging.getLogger(__name__)


# ============================================================================
# DATA FETCHING
# ============================================================================

def fetch_top_story_ids(limit: int = MAX_STORIES_TO_CHECK) -> List[int]:
    """
    Fetch the top story IDs from Hacker News.
    
    Args:
        limit: Maximum number of story IDs to fetch
    
    Returns:
        List of story IDs (integers)
    """
    try:
        response = requests.get(HN_TOP_STORIES_URL, timeout=10)
        response.raise_for_status()
        story_ids = response.json()
        return story_ids[:limit]
    except requests.RequestException as e:
        logger.error(f"Failed to fetch top story IDs: {e}")
        return []


def fetch_item(item_id: int) -> Optional[Dict[str, Any]]:
    """
    Fetch a single item (story/comment/job) from Hacker News by ID.
    
    Args:
        item_id: Hacker News item ID
    
    Returns:
        Item data as dict, or None if failed
    """
    url = HN_ITEM_URL.format(item_id)
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        logger.warning(f"Failed to fetch item {item_id}: {e}")
        return None


def fetch_items_batch(item_ids: List[int]) -> List[Dict[str, Any]]:
    """
    Fetch multiple items in sequence (not parallel, to be gentle to the API).
    
    Args:
        item_ids: List of Hacker News item IDs
    
    Returns:
        List of item data dicts (only successful fetches)
    """
    items = []
    for item_id in item_ids:
        item = fetch_item(item_id)
        if item:
            items.append(item)
        # Small delay to avoid rate limiting
        time.sleep(0.1)
    return items


# ============================================================================
# SHOW HN EXTRACTION
# ============================================================================

def is_show_hn(item: Dict[str, Any]) -> bool:
    """
    Check if an item is a "Show HN" post.
    
    Show HN posts have:
    - 'title' starting with "Show HN" or "Show HN:"
    - 'type' == "story"
    - Not dead or deleted
    """
    if item.get("type") != "story":
        return False
    if item.get("dead") or item.get("deleted"):
        return False
    
    title = item.get("title", "")
    return title.startswith("Show HN") or title.startswith("Show HN:")


def extract_url_from_show_hn(item: Dict[str, Any]) -> Optional[str]:
    """
    Extract the startup URL from a Show HN post.
    
    Priority:
    1. The 'url' field (direct link)
    2. Parse the 'text' field for a URL (sometimes founders post link in text)
    
    Returns:
        URL string or None if no URL found
    """
    # Check direct URL field
    url = item.get("url")
    if url:
        return url
    
    # Check text field for URL
    text = item.get("text", "")
    if text:
        import re
        # Simple regex to find URLs
        url_pattern = r'https?://[^\s<>"\'\)]+'
        matches = re.findall(url_pattern, text)
        if matches:
            return matches[0]  # Return first URL found
    
    return None


def parse_show_hn(item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Parse a Show HN item into a candidate object.
    
    Args:
        item: Hacker News item data
    
    Returns:
        Candidate dict or None if not a valid Show HN
    """
    if not is_show_hn(item):
        return None
    
    url = extract_url_from_show_hn(item)
    if not url:
        # Skip posts without URLs (often just discussion threads)
        return None
    
    # Extract metadata
    title = item.get("title", "")
    # Clean up "Show HN" prefix
    clean_title = title.replace("Show HN:", "").replace("Show HN", "").strip()
    
    author = item.get("by", "")
    score = item.get("score", 0)
    # Convert timestamp to ISO format
    timestamp = datetime.fromtimestamp(item.get("time", 0)).isoformat() if item.get("time") else None
    
    # Build candidate object
    return {
        "title": clean_title or title,
        "url": url,
        "source": "hackernews",
        "metadata": {
            "hn_id": item.get("id"),
            "author": author,
            "score": score,
            "timestamp": timestamp,
            "comments_count": item.get("descendants", 0),
            "raw_title": title,
        }
    }


# ============================================================================
# MAIN PUBLIC FUNCTION
# ============================================================================

def get_show_hn_posts(
    limit: int = MAX_STORIES_TO_CHECK,
    max_hours_back: int = MAX_HOURS_BACK
) -> List[Dict[str, Any]]:
    """
    Main function: Fetch recent Show HN posts with startup URLs.
    
    Args:
        limit: Number of top stories to check
        max_hours_back: Max age of posts to include (hours)
    
    Returns:
        List of candidate dicts with keys: title, url, source, metadata
    
    Example:
        >>> posts = get_show_hn_posts()
        >>> for post in posts:
        ...     print(f"{post['title']} - {post['url']}")
    """
    logger.info("Fetching Show HN posts...")
    
    # Fetch top story IDs
    story_ids = fetch_top_story_ids(limit)
    if not story_ids:
        logger.warning("No story IDs fetched from Hacker News")
        return []
    
    logger.info(f"Fetched {len(story_ids)} top story IDs")
    
    # Fetch item details
    items = fetch_items_batch(story_ids)
    logger.info(f"Fetched {len(items)} story details")
    
    # Parse Show HN posts
    candidates = []
    cutoff_time = datetime.utcnow() - timedelta(hours=max_hours_back)
    
    for item in items:
        # Check if it's a Show HN
        if not is_show_hn(item):
            continue
        
        # Check age
        item_time = datetime.fromtimestamp(item.get("time", 0))
        if item_time < cutoff_time:
            continue
        
        # Parse into candidate
        candidate = parse_show_hn(item)
        if candidate:
            # Add a raw summary for discovery agent
            raw_text = (
                f"Title: {candidate['title']}\n"
                f"Author: {candidate['metadata']['author']}\n"
                f"Score: {candidate['metadata']['score']}\n"
                f"Comments: {candidate['metadata']['comments_count']}\n"
                f"URL: {candidate['url']}\n"
            )
            candidate["raw_text"] = raw_text
            candidates.append(candidate)
    
    logger.info(f"Found {len(candidates)} Show HN posts with URLs")
    return candidates


# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def get_show_hn_by_search(limit: int = 20) -> List[Dict[str, Any]]:
    """
    Alternative: Use HN search API to find Show HN posts.
    
    Note: This uses Algolia's HN search API, which is rate-limited.
    Currently using the Firebase API method above as primary.
    
    This is kept as a fallback method if needed.
    """
    # Algolia HN Search API
    search_url = "https://hn.algolia.com/api/v1/search"
    params = {
        "query": "Show HN",
        "tags": "story",
        "hitsPerPage": limit,
    }
    
    try:
        response = requests.get(search_url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        candidates = []
        for hit in data.get("hits", []):
            url = hit.get("url")
            if not url:
                continue
            
            candidates.append({
                "title": hit.get("title", "").replace("Show HN:", "").strip(),
                "url": url,
                "source": "hackernews_search",
                "metadata": {
                    "hn_id": hit.get("objectID"),
                    "author": hit.get("author"),
                    "score": hit.get("points", 0),
                    "comments_count": hit.get("num_comments", 0),
                    "timestamp": hit.get("created_at"),
                },
                "raw_text": f"Title: {hit.get('title', '')}\nAuthor: {hit.get('author', '')}",
            })
        
        return candidates
    except requests.RequestException as e:
        logger.error(f"HN search API failed: {e}")
        return []


def get_show_hn_from_user(user: str, limit: int = 10) -> List[Dict[str, Any]]:
    """
    Fetch Show HN posts from a specific user (useful for follow-up).
    """
    search_url = "https://hn.algolia.com/api/v1/search"
    params = {
        "query": "Show HN",
        "tags": f"story,author_{user}",
        "hitsPerPage": limit,
    }
    
    try:
        response = requests.get(search_url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        candidates = []
        for hit in data.get("hits", []):
            url = hit.get("url")
            if not url:
                continue
            
            candidates.append({
                "title": hit.get("title", "").replace("Show HN:", "").strip(),
                "url": url,
                "source": "hackernews_user",
                "metadata": {
                    "hn_id": hit.get("objectID"),
                    "author": hit.get("author"),
                    "score": hit.get("points", 0),
                    "timestamp": hit.get("created_at"),
                },
            })
        
        return candidates
    except requests.RequestException as e:
        logger.error(f"Failed to fetch Show HN from user {user}: {e}")
        return []


# ============================================================================
# TESTING
# ============================================================================

if __name__ == "__main__":
    # Quick test
    logging.basicConfig(level=logging.INFO)
    
    print("\n🔍 Testing Hacker News Source...")
    
    # Fetch Show HN posts
    posts = get_show_hn_posts(limit=20, max_hours_back=24)
    
    print(f"\n✅ Found {len(posts)} Show HN posts in the last 24 hours:")
    for i, post in enumerate(posts[:5], 1):
        print(f"  {i}. {post['title'][:50]}...")
        print(f"     URL: {post['url'][:60]}...")
        print(f"     Source: {post['source']}")
        print()
    
    if not posts:
        print("ℹ️ No Show HN posts found. This is normal if no one has posted recently.")