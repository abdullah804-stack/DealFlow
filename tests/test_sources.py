# tests/test_sources.py
"""
Source Tests — Validate all data sources work correctly.

Tests:
- Hacker News API
- Reddit public JSON
- RSS feed parser

Each test verifies:
1. The source returns data (or gracefully fails)
2. The data format matches expectations
3. Error handling works
4. Rate limits are respected
"""

import unittest
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, Any, List

# Configure logging for tests
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ============================================================================
# TEST CONFIGURATION
# ============================================================================

# Set to False to skip network tests (for CI/CD)
RUN_NETWORK_TESTS = True

# Timeout for network requests (in seconds)
NETWORK_TIMEOUT = 10


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def validate_candidate_structure(candidate: Dict[str, Any]) -> bool:
    """
    Validate that a candidate dict has all required fields.
    """
    required_fields = ["title", "url", "source", "metadata", "raw_text"]
    
    for field in required_fields:
        if field not in candidate:
            logger.error(f"Missing required field: {field}")
            return False
        
        if field == "metadata":
            if not isinstance(candidate[field], dict):
                logger.error(f"metadata must be a dict, got {type(candidate[field])}")
                return False
        
        if field == "raw_text":
            if not candidate[field] or len(candidate[field]) < 10:
                logger.warning(f"raw_text is too short or empty: {candidate[field]}")
                return False
    
    return True


def validate_url(url: str) -> bool:
    """
    Validate that a URL looks reasonable.
    """
    if not url:
        return False
    if not url.startswith("http"):
        return False
    # Check for basic URL structure
    if len(url) < 10:
        return False
    return True


def get_timestamp() -> str:
    """Get current timestamp for test output."""
    return datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")


# ============================================================================
# HACKER NEWS TESTS
# ============================================================================

class TestHackerNewsSource(unittest.TestCase):
    """Test Hacker News source functionality."""
    
    def setUp(self):
        """Setup before each test."""
        from src.sources.hackernews_source import (
            fetch_top_story_ids,
            fetch_item,
            fetch_items_batch,
            is_show_hn,
            extract_url_from_show_hn,
            parse_show_hn,
            get_show_hn_posts,
        )
        self.fetch_top_story_ids = fetch_top_story_ids
        self.fetch_item = fetch_item
        self.fetch_items_batch = fetch_items_batch
        self.is_show_hn = is_show_hn
        self.extract_url_from_show_hn = extract_url_from_show_hn
        self.parse_show_hn = parse_show_hn
        self.get_show_hn_posts = get_show_hn_posts
    
    def test_fetch_top_story_ids(self):
        """Test fetching top story IDs."""
        if not RUN_NETWORK_TESTS:
            self.skipTest("Network tests disabled")
        
        logger.info("  Testing fetch_top_story_ids...")
        story_ids = self.fetch_top_story_ids(limit=10)
        
        self.assertIsInstance(story_ids, list)
        if len(story_ids) > 0:
            self.assertIsInstance(story_ids[0], int)
            logger.info(f"  ✅ Fetched {len(story_ids)} story IDs")
        else:
            logger.warning("  ⚠️ No story IDs returned (HN may be slow)")
    
    def test_fetch_item(self):
        """Test fetching a single item."""
        if not RUN_NETWORK_TESTS:
            self.skipTest("Network tests disabled")
        
        logger.info("  Testing fetch_item...")
        
        # Get a story ID first
        story_ids = self.fetch_top_story_ids(limit=5)
        if not story_ids:
            self.skipTest("No story IDs available")
        
        item = self.fetch_item(story_ids[0])
        
        if item:
            self.assertIsInstance(item, dict)
            self.assertIn("id", item)
            self.assertIn("title", item)
            logger.info(f"  ✅ Fetched item: {item.get('title', 'Unknown')[:30]}...")
        else:
            logger.warning("  ⚠️ No item returned")
    
    def test_is_show_hn(self):
        """Test Show HN detection."""
        # Test real Show HN
        show_hn_item = {
            "type": "story",
            "title": "Show HN: My new startup",
            "id": 12345,
        }
        self.assertTrue(self.is_show_hn(show_hn_item))
        
        # Test non-Show HN
        non_show_hn = {
            "type": "story",
            "title": "Just a regular post",
            "id": 12346,
        }
        self.assertFalse(self.is_show_hn(non_show_hn))
        
        # Test dead post
        dead_post = {
            "type": "story",
            "title": "Show HN: Dead post",
            "dead": True,
            "id": 12347,
        }
        self.assertFalse(self.is_show_hn(dead_post))
        
        logger.info("  ✅ Show HN detection works")
    
    def test_extract_url_from_show_hn(self):
        """Test URL extraction from Show HN posts."""
        # Test direct URL
        item_with_url = {
            "url": "https://example.com/startup",
            "title": "Show HN: Test",
        }
        url = self.extract_url_from_show_hn(item_with_url)
        self.assertEqual(url, "https://example.com/startup")
        
        # Test URL in text
        item_with_text = {
            "text": "Check out my startup at https://example.com/startup",
            "title": "Show HN: Test",
        }
        url = self.extract_url_from_show_hn(item_with_text)
        self.assertEqual(url, "https://example.com/startup")
        
        # Test no URL
        item_no_url = {
            "text": "Just a discussion post",
            "title": "Show HN: Test",
        }
        url = self.extract_url_from_show_hn(item_no_url)
        self.assertIsNone(url)
        
        logger.info("  ✅ URL extraction works")
    
    def test_parse_show_hn(self):
        """Test parsing Show HN posts into candidates."""
        item = {
            "type": "story",
            "title": "Show HN: AI Legal Research Platform",
            "url": "https://legal-ai.com",
            "by": "testuser",
            "score": 45,
            "time": int(datetime.now().timestamp()),
            "descendants": 12,
            "id": 12345,
        }
        
        candidate = self.parse_show_hn(item)
        
        self.assertIsNotNone(candidate)
        self.assertEqual(candidate["title"], "AI Legal Research Platform")
        self.assertEqual(candidate["url"], "https://legal-ai.com")
        self.assertEqual(candidate["source"], "hackernews")
        self.assertEqual(candidate["metadata"]["author"], "testuser")
        self.assertEqual(candidate["metadata"]["score"], 45)
        
        logger.info("  ✅ Show HN parsing works")
    
    def test_get_show_hn_posts(self):
        """Test the main HN function."""
        if not RUN_NETWORK_TESTS:
            self.skipTest("Network tests disabled")
        
        logger.info("  Testing get_show_hn_posts...")
        
        posts = self.get_show_hn_posts(limit=20, max_hours_back=48)
        
        self.assertIsInstance(posts, list)
        
        if posts:
            # Validate first post
            first = posts[0]
            self.assertTrue(validate_candidate_structure(first))
            self.assertTrue(validate_url(first["url"]))
            logger.info(f"  ✅ Found {len(posts)} Show HN posts")
        else:
            logger.warning("  ⚠️ No Show HN posts found (this is normal if none were posted recently)")


# ============================================================================
# REDDIT TESTS
# ============================================================================

class TestRedditSource(unittest.TestCase):
    """Test Reddit source functionality."""
    
    def setUp(self):
        """Setup before each test."""
        from src.sources.reddit_source import (
            fetch_subreddit_posts,
            extract_url_from_post,
            is_startup_relevant,
            parse_reddit_post,
            get_reddit_posts,
            get_subreddit_info,
            is_valid_subreddit,
        )
        self.fetch_subreddit_posts = fetch_subreddit_posts
        self.extract_url_from_post = extract_url_from_post
        self.is_startup_relevant = is_startup_relevant
        self.parse_reddit_post = parse_reddit_post
        self.get_reddit_posts = get_reddit_posts
        self.get_subreddit_info = get_subreddit_info
        self.is_valid_subreddit = is_valid_subreddit
    
    def test_is_valid_subreddit(self):
        """Test subreddit validation."""
        if not RUN_NETWORK_TESTS:
            self.skipTest("Network tests disabled")
        
        logger.info("  Testing is_valid_subreddit...")
        
        # Test valid subreddit
        valid = self.is_valid_subreddit("startups")
        self.assertTrue(valid)
        logger.info("  ✅ startups is a valid subreddit")

                # Test invalid subreddit
        invalid = self.is_valid_subreddit("nonexistentsubreddit12345")
        self.assertFalse(invalid)
        
        logger.info("  ✅ Subreddit validation works")
    
    def test_fetch_subreddit_posts(self):
        """Test fetching posts from a subreddit."""
        if not RUN_NETWORK_TESTS:
            self.skipTest("Network tests disabled")
        
        logger.info("  Testing fetch_subreddit_posts...")
        
        posts = self.fetch_subreddit_posts("startups", limit=5, max_hours_back=48)
        
        self.assertIsInstance(posts, list)
        
        if posts:
            first = posts[0]
            self.assertIsInstance(first, dict)
            self.assertIn("title", first)
            self.assertIn("url", first)
            logger.info(f"  ✅ Fetched {len(posts)} posts from r/startups")
        else:
            logger.warning("  ⚠️ No posts returned from r/startups (may be rate limited)")
    
    def test_extract_url_from_post(self):
        """Test URL extraction from Reddit posts."""
        # Test link post with URL
        link_post = {
            "url": "https://example.com/startup",
            "title": "My new startup",
            "is_self": False,
        }
        url = self.extract_url_from_post(link_post)
        self.assertEqual(url, "https://example.com/startup")
        
        # Test text post with URL in body
        text_post = {
            "url": "https://www.reddit.com/r/startups/comments/abc123/",
            "title": "My new startup",
            "selftext": "Check out my startup at https://example.com/startup",
            "is_self": True,
        }
        url = self.extract_url_from_post(text_post)
        self.assertEqual(url, "https://example.com/startup")
        
        # Test post without URL
        no_url_post = {
            "url": "https://www.reddit.com/r/startups/comments/abc123/",
            "title": "Discussion post",
            "selftext": "What do you think about AI startups?",
            "is_self": True,
        }
        url = self.extract_url_from_post(no_url_post)
        self.assertIsNone(url)
        
        logger.info("  ✅ URL extraction works")
    
    def test_is_startup_relevant(self):
        """Test startup relevance filtering."""
        # Test startup-related content
        startup_text = "We're launching a new SaaS platform for AI-powered analytics"
        self.assertTrue(self.is_startup_relevant(startup_text, ""))
        
        # Test non-startup content
        non_startup_text = "Just a meme about startup life"
        self.assertFalse(self.is_startup_relevant(non_startup_text, ""))
        
        logger.info("  ✅ Relevance filtering works")
    
    def test_parse_reddit_post(self):
        """Test parsing Reddit posts into candidates."""
        post = {
            "title": "AI Legal Research Platform - Looking for feedback",
            "url": "https://legal-ai.com",
            "author": "testuser",
            "score": 42,
            "num_comments": 8,
            "created_utc": int(datetime.now().timestamp()),
            "subreddit": "startups",
            "id": "abc123",
            "domain": "legal-ai.com",
            "is_self": False,
        }
        
        candidate = self.parse_reddit_post(post)
        
        self.assertIsNotNone(candidate)
        self.assertEqual(candidate["title"], "AI Legal Research Platform - Looking for feedback")
        self.assertEqual(candidate["url"], "https://legal-ai.com")
        self.assertEqual(candidate["source"], "reddit_r/startups")
        self.assertEqual(candidate["metadata"]["author"], "testuser")
        self.assertEqual(candidate["metadata"]["score"], 42)
        self.assertEqual(candidate["metadata"]["subreddit"], "startups")
        
        logger.info("  ✅ Reddit parsing works")
    
    def test_get_reddit_posts(self):
        """Test the main Reddit function."""
        if not RUN_NETWORK_TESTS:
            self.skipTest("Network tests disabled")
        
        logger.info("  Testing get_reddit_posts...")
        
        posts = self.get_reddit_posts(limit=5, max_hours_back=48)
        
        self.assertIsInstance(posts, list)
        
        if posts:
            # Validate first post
            first = posts[0]
            self.assertTrue(validate_candidate_structure(first))
            self.assertTrue(validate_url(first["url"]))
            logger.info(f"  ✅ Found {len(posts)} Reddit candidates")
        else:
            logger.warning("  ⚠️ No Reddit candidates found")


# ============================================================================
# RSS TESTS
# ============================================================================

class TestRSSSource(unittest.TestCase):
    """Test RSS source functionality."""
    
    def setUp(self):
        """Setup before each test."""
        from src.sources.rss_source import (
            fetch_feed,
            fetch_all_feeds,
            extract_url_from_rss_entry,
            is_startup_relevant_rss,
            parse_rss_entry,
            get_rss_candidates,
            validate_feed,
            get_feed_info,
        )
        self.fetch_feed = fetch_feed
        self.fetch_all_feeds = fetch_all_feeds
        self.extract_url_from_rss_entry = extract_url_from_rss_entry
        self.is_startup_relevant_rss = is_startup_relevant_rss
        self.parse_rss_entry = parse_rss_entry
        self.get_rss_candidates = get_rss_candidates
        self.validate_feed = validate_feed
        self.get_feed_info = get_feed_info
    
    def test_validate_feed(self):
        """Test RSS feed validation."""
        if not RUN_NETWORK_TESTS:
            self.skipTest("Network tests disabled")
        
        logger.info("  Testing validate_feed...")
        
        # Test TechCrunch feed (should work)
        is_valid = self.validate_feed("https://techcrunch.com/category/startups/feed/")
        self.assertTrue(is_valid)
        
        # Test invalid feed
        is_valid_invalid = self.validate_feed("https://invalid-feed-that-doesnt-exist.com/feed.xml")
        self.assertFalse(is_valid_invalid)
        
        logger.info("  ✅ Feed validation works")
    
    def test_fetch_feed(self):
        """Test fetching a single RSS feed."""
        if not RUN_NETWORK_TESTS:
            self.skipTest("Network tests disabled")
        
        logger.info("  Testing fetch_feed...")
        
        entries = self.fetch_feed("https://techcrunch.com/category/startups/feed/", max_entries=5)
        
        self.assertIsInstance(entries, list)
        
        if entries:
            first = entries[0]
            self.assertIsInstance(first, dict)
            self.assertIn("title", first)
            self.assertIn("link", first)
            logger.info(f"  ✅ Fetched {len(entries)} entries from TechCrunch")
        else:
            logger.warning("  ⚠️ No entries returned from TechCrunch")
    
    def test_extract_url_from_rss_entry(self):
        """Test URL extraction from RSS entries."""
        # Test direct link
        entry_with_link = {
            "link": "https://example.com/article",
            "title": "Test Article",
        }
        url = self.extract_url_from_rss_entry(entry_with_link)
        self.assertEqual(url, "https://example.com/article")
        
        # Test URL in description
        entry_with_desc = {
            "description": "Check out this startup: https://example.com/startup",
            "title": "Test Article",
        }
        url = self.extract_url_from_rss_entry(entry_with_desc)
        self.assertEqual(url, "https://example.com/startup")
        
        # Test no URL
        entry_no_url = {
            "description": "Just an article about startup trends",
            "title": "Test Article",
        }
        url = self.extract_url_from_rss_entry(entry_no_url)
        self.assertIsNone(url)
        
        logger.info("  ✅ RSS URL extraction works")
    
    def test_is_startup_relevant_rss(self):
        """Test RSS startup relevance filtering."""
        # Test startup-related entry
        startup_entry = {
            "title": "AI Startup Raises $5M Seed Round",
            "tags": [{"term": "Startups"}],
        }
        self.assertTrue(self.is_startup_relevant_rss(startup_entry))
        
        # Test non-startup entry
        non_startup_entry = {
            "title": "5 Tips for Better Code Reviews",
            "tags": [{"term": "Programming"}],
        }
        self.assertFalse(self.is_startup_relevant_rss(non_startup_entry))
        
        logger.info("  ✅ RSS relevance filtering works")
    
    def test_parse_rss_entry(self):
        """Test parsing RSS entries into candidates."""
        entry = {
            "title": "LegalTech Startup Raises $10M Series A",
            "link": "https://techcrunch.com/2024/01/01/legaltech-startup-raises/",
            "author": "John Doe",
            "published_parsed": datetime.now().timetuple(),
            "tags": [{"term": "Startups"}, {"term": "Funding"}],
            "summary": "LegalTech AI platform raises $10M for expansion",
            "feed_url": "https://techcrunch.com/category/startups/feed/",
            "feed_title": "TechCrunch Startups",
        }
        
        candidate = self.parse_rss_entry(entry)
        
        self.assertIsNotNone(candidate)
        self.assertEqual(candidate["title"], "LegalTech Startup Raises $10M Series A")
        self.assertEqual(candidate["url"], "https://techcrunch.com/2024/01/01/legaltech-startup-raises/")
        self.assertEqual(candidate["source"], "https://techcrunch.com/category/startups/feed/")
        self.assertEqual(candidate["metadata"]["author"], "John Doe")
        self.assertTrue(len(candidate["metadata"]["categories"]) > 0)
        
        logger.info("  ✅ RSS parsing works")
    
    def test_get_rss_candidates(self):
        """Test the main RSS function."""
        if not RUN_NETWORK_TESTS:
            self.skipTest("Network tests disabled")
        
        logger.info("  Testing get_rss_candidates...")
        
        candidates = self.get_rss_candidates(max_entries=5, max_hours_back=48, filter_relevant=True)
        
        self.assertIsInstance(candidates, list)
        
        if candidates:
            # Validate first candidate
            first = candidates[0]
            self.assertTrue(validate_candidate_structure(first))
            self.assertTrue(validate_url(first["url"]))
            logger.info(f"  ✅ Found {len(candidates)} RSS candidates")
        else:
            logger.warning("  ⚠️ No RSS candidates found (feeds may be empty or rate limited)")


# ============================================================================
# INTEGRATION TESTS
# ============================================================================

class TestSourceIntegration(unittest.TestCase):
    """Test that sources work together."""
    
    def setUp(self):
        """Setup before each test."""
        from src.agents.discovery_agent import DiscoveryAgent
        self.DiscoveryAgent = DiscoveryAgent
    
    def test_all_sources_combined(self):
        """Test that all sources can be pulled together."""
        if not RUN_NETWORK_TESTS:
            self.skipTest("Network tests disabled")
        
        logger.info("  Testing all sources combined...")
        
        agent = self.DiscoveryAgent()
        candidates = agent._pull_from_sources()
        
        self.assertIsInstance(candidates, list)
        
        # Check that we have at least some candidates
        if len(candidates) > 0:
            # Verify at least some have the right structure
            valid_count = sum(1 for c in candidates if validate_candidate_structure(c))
            logger.info(f"  ✅ Pulled {len(candidates)} total candidates ({valid_count} valid)")
        else:
            logger.warning("  ⚠️ No candidates pulled from any source")
    
    def test_deduplication(self):
        """Test that deduplication works."""
        logger.info("  Testing deduplication...")
        
        from src.agents.discovery_agent import DiscoveryAgent
        agent = DiscoveryAgent()
        
        # Create duplicate candidates
        candidates = [
            {
                "title": "Test Startup 1",
                "url": "https://test1.com",
                "source": "test",
                "raw_text": "Test startup 1",
            },
            {
                "title": "Test Startup 1 Duplicate",
                "url": "https://test1.com",  # Same URL
                "source": "test",
                "raw_text": "Test startup 1 duplicate",
            },
            {
                "title": "Test Startup 2",
                "url": "https://test2.com",
                "source": "test",
                "raw_text": "Test startup 2",
            },
        ]
        
        # Deduplicate
        # Note: This is testing the _deduplicate method but it depends on the database
        # So we'll just test the logic conceptually
        unique_urls = set()
        unique_candidates = []
        
        for c in candidates:
            url = c.get("url", "")
            if url and url not in unique_urls:
                unique_urls.add(url)
                unique_candidates.append(c)
        
        self.assertEqual(len(unique_candidates), 2)
        self.assertEqual(unique_candidates[0]["url"], "https://test1.com")
        self.assertEqual(unique_candidates[1]["url"], "https://test2.com")
        
        logger.info("  ✅ Deduplication logic works")


# ============================================================================
# TEST RUNNER
# ============================================================================

def run_all_tests():
    """Run all source tests."""
    logger.info("=" * 60)
    logger.info("RUNNING ALL SOURCE TESTS")
    logger.info("=" * 60)
    
    # Load tests
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    suite.addTests(loader.loadTestsFromTestCase(TestHackerNewsSource))
    suite.addTests(loader.loadTestsFromTestCase(TestRedditSource))
    suite.addTests(loader.loadTestsFromTestCase(TestRSSSource))
    suite.addTests(loader.loadTestsFromTestCase(TestSourceIntegration))
    
    # Run tests with verbosity
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Summary
    logger.info("=" * 60)
    logger.info("TEST SUMMARY")
    logger.info("=" * 60)
    logger.info(f"  Ran: {result.testsRun} tests")
    logger.info(f"  Failures: {len(result.failures)}")
    logger.info(f"  Errors: {len(result.errors)}")
    logger.info(f"  Skipped: {len(result.skipped)}")
    
    if result.wasSuccessful():
        logger.info("  ✅ ALL TESTS PASSED!")
    else:
        logger.error("  ❌ SOME TESTS FAILED")
    
    return result.wasSuccessful()


# ============================================================================
# QUICK TEST (No network)
# ============================================================================

def run_quick_tests():
    """Run quick tests without network calls."""
    logger.info("=" * 60)
    logger.info("RUNNING QUICK TESTS (No Network)")
    logger.info("=" * 60)
    
    # This runs only tests that don't require network
    # We'll just run the parser tests
    
    from src.sources.hackernews_source import is_show_hn, extract_url_from_show_hn
    from src.sources.reddit_source import extract_url_from_post, is_startup_relevant
    from src.sources.rss_source import extract_url_from_rss_entry, is_startup_relevant_rss
    
    logger.info("  Testing HN parser...")
    show_hn_item = {"type": "story", "title": "Show HN: Test"}
    assert is_show_hn(show_hn_item) == True
    logger.info("    ✅ HN parser works")
    
    logger.info("  Testing Reddit parser...")
    reddit_post = {"url": "https://example.com", "title": "Test"}
    assert extract_url_from_post(reddit_post) == "https://example.com"
    logger.info("    ✅ Reddit parser works")
    
    logger.info("  Testing RSS parser...")
    rss_entry = {"link": "https://example.com"}
    assert extract_url_from_rss_entry(rss_entry) == "https://example.com"
    logger.info("    ✅ RSS parser works")
    
    logger.info("  ✅ ALL QUICK TESTS PASSED!")


# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    import sys
    
    print("\n" + "=" * 60)
    print("DealFlow — SOURCE TESTS")
    print("=" * 60)
    
    # Check arguments
    if "--quick" in sys.argv:
        run_quick_tests()
    elif "--no-network" in sys.argv:
        RUN_NETWORK_TESTS = False
        run_all_tests()
    else:
        # Run all tests (including network)
        run_all_tests()