# src/sources/rss_source.py
"""
RSS Source — Parse RSS feeds for startup news and announcements.

Uses feedparser library (free, no key required).
Fetches recent articles from configured RSS feeds and extracts startup information.

Feeds monitored (from settings.py):
- TechCrunch Startups: https://techcrunch.com/category/startups/feed/
- Additional feeds can be added to RSS_FEEDS in settings.py
"""

import logging
import time
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import re

import feedparser

from config.settings import RSS_FEEDS

# How many entries to fetch per feed
MAX_ENTRIES_PER_FEED = 20

# How far back to look (in hours)
MAX_HOURS_BACK = 48

logger = logging.getLogger(__name__)


# ============================================================================
# FEED FETCHING
# ============================================================================

def fetch_feed(feed_url: str, max_entries: int = MAX_ENTRIES_PER_FEED) -> List[Dict[str, Any]]:
    """
    Fetch and parse a single RSS feed.
    
    Args:
        feed_url: URL of the RSS feed
        max_entries: Maximum number of entries to return
    
    Returns:
        List of parsed entry dicts
    
    Example:
        >>> entries = fetch_feed("https://techcrunch.com/category/startups/feed/")
        >>> for entry in entries:
        ...     print(entry['title'])
    """
    try:
        logger.debug(f"Fetching RSS feed: {feed_url}")
        feed = feedparser.parse(feed_url)
        
        if feed.bozo:  # bozo = parsing error
            logger.warning(f"Feed parsing issue for {feed_url}: {feed.bozo_exception}")
        
        entries = feed.entries[:max_entries]
        logger.debug(f"Fetched {len(entries)} entries from {feed_url}")
        
        return entries
        
    except Exception as e:
        logger.error(f"Failed to fetch RSS feed {feed_url}: {e}")
        return []


def fetch_all_feeds(
    feed_urls: Optional[List[str]] = None,
    max_entries: int = MAX_ENTRIES_PER_FEED,
    max_hours_back: int = MAX_HOURS_BACK
) -> List[Dict[str, Any]]:
    """
    Fetch all configured RSS feeds and return entries.
    
    Args:
        feed_urls: List of feed URLs (default: from settings)
        max_entries: Max entries per feed
        max_hours_back: Max age of entries to include (hours)
    
    Returns:
        List of entry dicts with feed_url added
    """
    if feed_urls is None:
        feed_urls = RSS_FEEDS
    
    all_entries = []
    cutoff_time = datetime.utcnow() - timedelta(hours=max_hours_back)
    
    for feed_url in feed_urls:
        entries = fetch_feed(feed_url, max_entries)
        
        for entry in entries:
            # Check publication date
            published = entry.get("published_parsed") or entry.get("updated_parsed")
            if published:
                entry_time = datetime(*published[:6])  # Convert time.struct_time to datetime
                if entry_time < cutoff_time:
                    continue
            else:
                # If no date, keep it (assume recent)
                logger.debug(f"No publication date for entry: {entry.get('title', 'Unknown')}")
            
            # Add feed URL for source tracking
            entry["feed_url"] = feed_url
            all_entries.append(entry)
        
        # Small delay between feeds to be polite
        time.sleep(0.3)
    
    logger.info(f"Fetched {len(all_entries)} entries from {len(feed_urls)} RSS feeds")
    return all_entries


# ============================================================================
# URL EXTRACTION
# ============================================================================

def extract_url_from_rss_entry(entry: Dict[str, Any]) -> Optional[str]:
    """
    Extract the startup URL from an RSS entry.
    
    Priority:
    1. Link field (direct article link)
    2. Parse description for URL
    3. Parse content for URL
    4. Look for startup-specific patterns
    
    Args:
        entry: RSS entry dict
    
    Returns:
        URL string or None if no URL found
    """
    # Check direct link field
    url = entry.get("link")
    if url:
        return url
    
    # Check description for URL
    description = entry.get("description", "")
    if description:
        # Look for URLs in description
        url_pattern = r'https?://[^\s<>"\'\)]+'
        matches = re.findall(url_pattern, description)
        if matches:
            # Return first URL that isn't a relative link
            for match in matches:
                if match.startswith("http"):
                    return match
    
    # Check content for URL
    content = entry.get("content")
    if content:
        # content can be a list of dicts or a string
        if isinstance(content, list):
            for item in content:
                if isinstance(item, dict):
                    content_text = item.get("value", "")
                    matches = re.findall(r'https?://[^\s<>"\'\)]+', content_text)
                    if matches:
                        return matches[0]
        elif isinstance(content, str):
            matches = re.findall(r'https?://[^\s<>"\'\)]+', content)
            if matches:
                return matches[0]
    
    # Check summary
    summary = entry.get("summary", "")
    if summary:
        matches = re.findall(r'https?://[^\s<>"\'\)]+', summary)
        if matches:
            return matches[0]
    
    return None


# ============================================================================
# ENTRY PARSING
# ============================================================================

def parse_rss_entry(entry: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Parse an RSS entry into a candidate object.
    
    Args:
        entry: RSS entry dict
    
    Returns:
        Candidate dict or None if not a valid candidate
    """
    # Extract URL
    url = extract_url_from_rss_entry(entry)
    if not url:
        return None
    
    title = entry.get("title", "").strip()
    if not title:
        return None
    
    # Extract publication date
    published = entry.get("published_parsed") or entry.get("updated_parsed")
    timestamp = datetime(*published[:6]).isoformat() if published else None
    
    # Extract author
    author = entry.get("author") or entry.get("creator") or entry.get("dc:creator") or "unknown"
    if isinstance(author, list):
        author = author[0] if author else "unknown"
    
    # Extract categories
    categories = []
    if "tags" in entry:
        for tag in entry["tags"]:
            if isinstance(tag, dict):
                term = tag.get("term") or tag.get("label") or tag.get("title")
                if term:
                    categories.append(term)
    
    # Extract summary
    summary = entry.get("summary") or entry.get("description") or entry.get("content", "")
    if isinstance(summary, list):
        summary = " ".join(str(item) for item in summary)
    
    # Build candidate object
    return {
        "title": title,
        "url": url,
        "source": entry.get("feed_url", "rss"),
        "metadata": {
            "feed_url": entry.get("feed_url"),
            "feed_title": entry.get("feed_title"),
            "author": author,
            "timestamp": timestamp,
            "categories": categories,
            "summary": summary[:500] if summary else "",  # Truncate for memory
            "entry_id": entry.get("id") or entry.get("guid"),
        }
    }


# ============================================================================
# STARTUP RELEVANCE FILTER (Optional)
# ============================================================================

def is_startup_relevant_rss(entry: Dict[str, Any]) -> bool:
    """
    Check if an RSS entry is likely about a startup.
    
    This is a lightweight filter before the Discovery Agent.
    """
    title = entry.get("title", "").lower()
    summary = (entry.get("summary") or entry.get("description") or "").lower()
    categories = [c.lower() for c in entry.get("categories", [])]
    
    text = title + " " + summary
    
    # Startup-related keywords
    startup_keywords = [
        "startup", "launch", "funding", "seed", "series", "venture",
        "founder", "ceo", "company", "app", "platform", "saas",
        "tech", "ai", "machine learning", "blockchain", "crypto",
        "raises", "announces", "debuts", "unveils",
    ]
    
    # Keywords that indicate non-startup content
    non_startup_keywords = [
        "opinion", "editorial", "review", "tips", "how to",
        "security", "policy", "regulation", "law",
    ]
    
    has_startup = any(kw in text for kw in startup_keywords) or any(kw in categories for kw in startup_keywords)
    has_non_startup = any(kw in text for kw in non_startup_keywords)
    
    return has_startup and not has_non_startup


# ============================================================================
# MAIN PUBLIC FUNCTION
# ============================================================================

def get_rss_candidates(
    feed_urls: Optional[List[str]] = None,
    max_entries: int = MAX_ENTRIES_PER_FEED,
    max_hours_back: int = MAX_HOURS_BACK,
    filter_relevant: bool = True
) -> List[Dict[str, Any]]:
    """
    Main function: Fetch startup candidates from RSS feeds.
    
    Args:
        feed_urls: List of RSS feed URLs (default: from settings)
        max_entries: Max entries per feed
        max_hours_back: Max age of entries to include (hours)
        filter_relevant: Whether to apply startup relevance filter
    
    Returns:
        List of candidate dicts with keys: title, url, source, metadata, raw_text
    
    Example:
        >>> candidates = get_rss_candidates()
        >>> for candidate in candidates:
        ...     print(f"{candidate['title']} - {candidate['url']}")
    """
    logger.info("Fetching RSS feed candidates...")
    
    # Fetch all feed entries
    entries = fetch_all_feeds(feed_urls, max_entries, max_hours_back)
    
    candidates = []
    for entry in entries:
        # Apply relevance filter if requested
        if filter_relevant and not is_startup_relevant_rss(entry):
            continue
        
        # Parse into candidate
        candidate = parse_rss_entry(entry)
        if candidate:
            # Add raw text for Discovery Agent
            raw_text = (
                f"Title: {candidate['title']}\n"
                f"Author: {candidate['metadata']['author']}\n"
                f"Feed: {candidate['metadata']['feed_title'] or candidate['metadata']['feed_url']}\n"
                f"Categories: {', '.join(candidate['metadata']['categories'])}\n"
                f"Summary: {candidate['metadata']['summary'][:200]}...\n"
                f"URL: {candidate['url']}\n"
            )
            candidate["raw_text"] = raw_text
            candidates.append(candidate)
    
    logger.info(f"Found {len(candidates)} candidates from RSS feeds")
    return candidates


# ============================================================================
# SPECIALIZED FETCHERS
# ============================================================================

def get_startup_news_feeds() -> List[str]:
    """
    Get a curated list of startup news RSS feeds.
    """
    return [
        "https://techcrunch.com/category/startups/feed/",
        "https://techcrunch.com/category/funding/feed/",
        "https://techcrunch.com/category/venture/feed/",
        "https://www.wired.com/feed/rss",
        "https://www.theinformation.com/feed",
    ]


def get_feed_info(feed_url: str) -> Dict[str, Any]:
    """
    Get metadata about an RSS feed.
    """
    try:
        feed = feedparser.parse(feed_url)
        return {
            "title": feed.feed.get("title", "Unknown"),
            "description": feed.feed.get("description", ""),
            "link": feed.feed.get("link", ""),
            "entries_count": len(feed.entries),
            "bozo": feed.bozo,
        }
    except Exception as e:
        logger.error(f"Failed to get feed info for {feed_url}: {e}")
        return {"error": str(e)}


def validate_feed(feed_url: str) -> bool:
    """
    Check if an RSS feed is valid and accessible.
    """
    try:
        feed = feedparser.parse(feed_url)
        # Check if we got any entries
        return len(feed.entries) > 0 and not feed.bozo
    except Exception:
        return False


# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def filter_rss_by_category(entries: List[Dict[str, Any]], categories: List[str]) -> List[Dict[str, Any]]:
    """
    Filter RSS entries by category.
    """
    filtered = []
    categories_lower = [c.lower() for c in categories]
    
    for entry in entries:
        entry_categories = entry.get("tags", [])
        entry_categories_lower = [
            tag.get("term", "").lower() if isinstance(tag, dict) else str(tag).lower()
            for tag in entry_categories
        ]
        
        if any(cat in categories_lower for cat in entry_categories_lower):
            filtered.append(entry)
    
    return filtered


def extract_keywords_from_rss_entry(entry: Dict[str, Any]) -> List[str]:
    """
    Extract keywords from an RSS entry for discovery.
    """
    text = (entry.get("title", "") + " " + 
            (entry.get("summary") or entry.get("description") or ""))
    
    # Simple word extraction
    words = re.findall(r'\b[a-z]{3,}\b', text.lower())
    
    # Remove common words
    stopwords = {
        'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all',
        'can', 'had', 'her', 'was', 'one', 'our', 'out', 'its',
        'has', 'new', 'how', 'use', 'get', 'will'
    }
    
    keywords = [w for w in words if w not in stopwords]
    return list(set(keywords))


# ============================================================================
# TESTING
# ============================================================================

if __name__ == "__main__":
    # Quick test
    logging.basicConfig(level=logging.INFO)
    
    print("\n🔍 Testing RSS Source...")
    
    # Validate feeds
    print("\n📡 Validating configured feeds:")
    for feed_url in RSS_FEEDS:
        is_valid = validate_feed(feed_url)
        status = "✅" if is_valid else "❌"
        print(f"  {status} {feed_url}")
    
    # Fetch candidates
    print(f"\n📥 Fetching candidates from {len(RSS_FEEDS)} feeds...")
    candidates = get_rss_candidates(max_entries=5, max_hours_back=24, filter_relevant=True)
    
    print(f"\n✅ Found {len(candidates)} candidates in the last 24 hours:")
    for i, candidate in enumerate(candidates[:5], 1):
        print(f"  {i}. {candidate['title'][:50]}...")
        print(f"     URL: {candidate['url'][:60]}...")
        print(f"     Source: {candidate['source']}")
        print()
    
    if not candidates:
        print("ℹ️ No candidates found. This could mean:")
        print("   - No recent startup articles in the configured feeds")
        print("   - Feeds are not accessible")
        print("   - Network issues")