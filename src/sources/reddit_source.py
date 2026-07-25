# src/sources/reddit_source.py
"""
Reddit Source — Scrape startup-related subreddits for startup candidates.

Uses Reddit's public JSON API (no key required).
Fetches recent posts from configured subreddits and extracts startup information.

Subreddits monitored:
- r/startups: General startup discussions
- r/SideProject: Side projects and indie hackers
- r/Entrepreneur: Entrepreneur community

Requires a custom User-Agent header (Reddit API policy).
"""

import logging
import time
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import re

import requests

from config.settings import REDDIT_SUBREDDITS

# Reddit API configuration
REDDIT_BASE_URL = "https://www.reddit.com"
REDDIT_USER_AGENT = (
    "Mozilla/5.0 (compatible; VentureScoutAI/1.0; "
    "+https://github.com/yourusername/venturescout-ai)"
)

# How many posts to fetch per subreddit
POSTS_PER_SUBREDDIT = 25

# How far back to look (in hours)
MAX_HOURS_BACK = 48

logger = logging.getLogger(__name__)


# ============================================================================
# DATA FETCHING
# ============================================================================

def fetch_subreddit_posts(
    subreddit: str,
    limit: int = POSTS_PER_SUBREDDIT,
    sort: str = "hot",
    max_hours_back: int = MAX_HOURS_BACK
) -> List[Dict[str, Any]]:
    """
    Fetch recent posts from a subreddit using the public JSON API.
    
    Args:
        subreddit: Subreddit name (e.g., "startups")
        limit: Number of posts to fetch
        sort: Sort order ("hot", "new", "top", "rising")
        max_hours_back: Max age of posts to include (hours)
    
    Returns:
        List of post data dicts
    
    Example:
        >>> posts = fetch_subreddit_posts("startups", limit=10)
        >>> for post in posts:
        ...     print(post['title'])
    """
    url = f"{REDDIT_BASE_URL}/r/{subreddit}/{sort}.json"
    params = {"limit": limit}
    
    headers = {
        "User-Agent": REDDIT_USER_AGENT,
        "Accept": "application/json",
    }
    
    try:
        response = requests.get(url, params=params, headers=headers, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        # Extract posts from the response
        posts = []
        for child in data.get("data", {}).get("children", []):
            post_data = child.get("data", {})
            if post_data:
                posts.append(post_data)
        
        # Filter by age
        cutoff_time = datetime.utcnow() - timedelta(hours=max_hours_back)
        filtered_posts = []
        for post in posts:
            created_utc = post.get("created_utc", 0)
            created_time = datetime.fromtimestamp(created_utc)
            if created_time >= cutoff_time:
                filtered_posts.append(post)
        
        logger.debug(f"Fetched {len(filtered_posts)} posts from r/{subreddit}")
        return filtered_posts
        
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 404:
            logger.warning(f"Subreddit r/{subreddit} not found")
        elif e.response.status_code == 403:
            logger.warning(f"Subreddit r/{subreddit} is private or restricted")
        else:
            logger.error(f"HTTP error fetching r/{subreddit}: {e}")
        return []
    except requests.RequestException as e:
        logger.error(f"Failed to fetch r/{subreddit}: {e}")
        return []


# ============================================================================
# URL EXTRACTION
# ============================================================================

def extract_url_from_post(post: Dict[str, Any]) -> Optional[str]:
    """
    Extract the startup URL from a Reddit post.
    
    Priority:
    1. URL field (link posts)
    2. Parse selftext for URL (text posts)
    3. Look for common patterns (showcases, launches, demos)
    
    Args:
        post: Reddit post data dict
    
    Returns:
        URL string or None if no URL found
    """
    # Check direct URL field (link posts)
    url = post.get("url", "")
    if url and not url.startswith("/r/") and not url.startswith("https://www.reddit.com"):
        # Skip internal Reddit links
        return url
    
    # Check selftext (text posts)
    selftext = post.get("selftext", "")
    if selftext:
        # Look for URLs in selftext
        url_pattern = r'https?://[^\s<>"\'\)]+'
        matches = re.findall(url_pattern, selftext)
        if matches:
            # Return first URL that isn't a Reddit link
            for match in matches:
                if not match.startswith("https://www.reddit.com"):
                    return match
    
    # Check for URL in title (sometimes people post URLs in title)
    title = post.get("title", "")
    url_pattern = r'https?://[^\s<>"\'\)]+'
    matches = re.findall(url_pattern, title)
    if matches:
        for match in matches:
            if not match.startswith("https://www.reddit.com"):
                return match
    
    return None


def is_startup_relevant(title: str, selftext: str) -> bool:
    """
    Quick heuristic to filter out non-startup posts.
    
    This is a lightweight filter before the Discovery Agent.
    The Agent will do a more thorough classification.
    """
    text = (title + " " + selftext).lower()
    
    # Keywords that indicate startup-related content
    startup_keywords = [
        "startup", "launch", "product", "app", "platform", "saas",
        "market", "founder", "team", "investor", "venture", "seed",
        "mvp", "prototype", "demo", "beta", "funding", "revenue",
        "growth", "user", "customer", "tech", "ai", "ml", "blockchain",
    ]
    
    # Keywords that indicate non-startup content
    non_startup_keywords = [
        "meme", "joke", "shitpost", "off-topic", "fluff",
        "political", "opinion", "editorial",
    ]
    
    has_startup = any(kw in text for kw in startup_keywords)
    has_non_startup = any(kw in text for kw in non_startup_keywords)
    
    return has_startup and not has_non_startup


# ============================================================================
# POST PARSING
# ============================================================================

def parse_reddit_post(post: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Parse a Reddit post into a candidate object.
    
    Args:
        post: Reddit post data dict
    
    Returns:
        Candidate dict or None if not a valid candidate
    """
    # Extract URL
    url = extract_url_from_post(post)
    if not url:
        return None
    
    title = post.get("title", "").strip()
    if not title:
        return None
    
    # Quick relevance filter (optional, Discovery Agent will do full classification)
    # We're keeping all posts with URLs for now; Discovery Agent will filter
    # Uncomment the following lines to apply the heuristic filter:
    # if not is_startup_relevant(title, post.get("selftext", "")):
    #     return None
    
    # Extract metadata
    author = post.get("author", "")
    score = post.get("score", 0)
    comments_count = post.get("num_comments", 0)
    created_utc = post.get("created_utc", 0)
    timestamp = datetime.fromtimestamp(created_utc).isoformat() if created_utc else None
    
    # Build candidate object
    return {
        "title": title,
        "url": url,
        "source": f"reddit_r/{post.get('subreddit', '')}",
        "metadata": {
            "post_id": post.get("id"),
            "subreddit": post.get("subreddit"),
            "author": author,
            "score": score,
            "comments_count": comments_count,
            "timestamp": timestamp,
            "is_self_post": post.get("is_self", False),
            "num_comments": post.get("num_comments", 0),
            "url_domain": post.get("domain", ""),
        }
    }


# ============================================================================
# MAIN PUBLIC FUNCTION
# ============================================================================

def get_reddit_posts(
    subreddits: Optional[List[str]] = None,
    limit: int = POSTS_PER_SUBREDDIT,
    sort: str = "hot",
    max_hours_back: int = MAX_HOURS_BACK
) -> List[Dict[str, Any]]:
    """
    Main function: Fetch recent startup-related posts from Reddit.
    
    Args:
        subreddits: List of subreddits to fetch (default: from settings)
        limit: Number of posts per subreddit
        sort: Sort order ("hot", "new", "top", "rising")
        max_hours_back: Max age of posts to include (hours)
    
    Returns:
        List of candidate dicts with keys: title, url, source, metadata, raw_text
    
    Example:
        >>> posts = get_reddit_posts()
        >>> for post in posts:
        ...     print(f"{post['title']} - {post['url']}")
    """
    if subreddits is None:
        subreddits = REDDIT_SUBREDDITS
    
    logger.info(f"Fetching Reddit posts from {len(subreddits)} subreddits...")
    
    all_candidates = []
    
    for subreddit in subreddits:
        logger.debug(f"Fetching r/{subreddit}...")
        
        posts = fetch_subreddit_posts(subreddit, limit=limit, sort=sort, max_hours_back=max_hours_back)
        
        for post in posts:
            candidate = parse_reddit_post(post)
            if candidate:
                # Add raw text for Discovery Agent
                raw_text = (
                    f"Title: {candidate['title']}\n"
                    f"Author: {candidate['metadata']['author']}\n"
                    f"Subreddit: r/{candidate['metadata']['subreddit']}\n"
                    f"Score: {candidate['metadata']['score']}\n"
                    f"Comments: {candidate['metadata']['comments_count']}\n"
                    f"URL: {candidate['url']}\n"
                )
                candidate["raw_text"] = raw_text
                all_candidates.append(candidate)
        
        # Small delay between subreddits to be polite
        time.sleep(0.5)
    
    logger.info(f"Found {len(all_candidates)} candidates from Reddit")
    return all_candidates


# ============================================================================
# SPECIALIZED FETCHERS
# ============================================================================

def get_reddit_search_results(
    query: str,
    limit: int = 25,
    max_hours_back: int = MAX_HOURS_BACK
) -> List[Dict[str, Any]]:
    """
    Search Reddit for startup-related posts by query.
    
    This uses the Reddit search API (public JSON).
    
    Args:
        query: Search query string
        limit: Number of results to fetch
        max_hours_back: Max age of posts to include (hours)
    
    Returns:
        List of candidate dicts
    """
    url = f"{REDDIT_BASE_URL}/search.json"
    params = {
        "q": query,
        "limit": limit,
    }
    
    headers = {
        "User-Agent": REDDIT_USER_AGENT,
        "Accept": "application/json",
    }
    
    try:
        response = requests.get(url, params=params, headers=headers, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        candidates = []
        cutoff_time = datetime.utcnow() - timedelta(hours=max_hours_back)
        
        for child in data.get("data", {}).get("children", []):
            post = child.get("data", {})
            if not post:
                continue
            
            # Check age
            created_utc = post.get("created_utc", 0)
            created_time = datetime.fromtimestamp(created_utc)
            if created_time < cutoff_time:
                continue
            
            candidate = parse_reddit_post(post)
            if candidate:
                candidate["raw_text"] = f"Title: {candidate['title']}\nURL: {candidate['url']}"
                candidates.append(candidate)
        
        return candidates
        
    except requests.RequestException as e:
        logger.error(f"Reddit search failed: {e}")
        return []


def get_top_startup_posts(limit: int = 25) -> List[Dict[str, Any]]:
    """
    Fetch top posts from all startup-related subreddits.
    Uses the "top" sort with time filter.
    """
    all_candidates = []
    for subreddit in REDDIT_SUBREDDITS:
        posts = fetch_subreddit_posts(subreddit, limit=limit, sort="top")
        for post in posts:
            candidate = parse_reddit_post(post)
            if candidate:
                candidate["raw_text"] = f"Title: {candidate['title']}\nURL: {candidate['url']}"
                all_candidates.append(candidate)
        time.sleep(0.5)
    
    return all_candidates


# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def get_subreddit_info(subreddit: str) -> Dict[str, Any]:
    """
    Get information about a subreddit (subscribers, description, etc.)
    """
    url = f"{REDDIT_BASE_URL}/r/{subreddit}/about.json"
    headers = {"User-Agent": REDDIT_USER_AGENT}
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        data = response.json()
        return data.get("data", {})
    except requests.RequestException as e:
        logger.error(f"Failed to get info for r/{subreddit}: {e}")
        return {}


def is_valid_subreddit(subreddit: str) -> bool:
    """Check if a subreddit exists and is accessible."""
    info = get_subreddit_info(subreddit)
    return bool(info.get("display_name"))


# ============================================================================
# TESTING
# ============================================================================

if __name__ == "__main__":
    # Quick test
    logging.basicConfig(level=logging.INFO)
    
    print("\n🔍 Testing Reddit Source...")
    
    # Test subreddit info
    for subreddit in REDDIT_SUBREDDITS:
        info = get_subreddit_info(subreddit)
        if info:
            subscribers = info.get("subscribers", 0)
            print(f"  ✅ r/{subreddit} exists ({subscribers:,} subscribers)")
        else:
            print(f"  ❌ r/{subreddit} not accessible")
    
    # Fetch posts
    print(f"\n📥 Fetching posts from {len(REDDIT_SUBREDDITS)} subreddits...")
    posts = get_reddit_posts(limit=5, max_hours_back=24)
    
    print(f"\n✅ Found {len(posts)} candidates in the last 24 hours:")
    for i, post in enumerate(posts[:5], 1):
        print(f"  {i}. {post['title'][:50]}...")
        print(f"     URL: {post['url'][:60]}...")
        print(f"     Source: {post['source']}")
        print()
    
    if not posts:
        print("ℹ️ No posts found. This could mean:")
        print("   - No recent startup posts in the monitored subreddits")
        print("   - Rate limiting by Reddit")
        print("   - Network issues")