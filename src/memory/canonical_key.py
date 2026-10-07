"""
Canonical key — stable deduplication identifier for candidates.

Given a raw URL and source name, produce a canonical key that:
- Strips protocol, www., path, query, fragment
- Lowercases the hostname
- Falls back to "{source}:{source_id}" if the URL has no usable domain

Examples:
    https://acme.io/pricing?utm=x   ->  "acme.io"
    http://www.acme.io/             ->  "acme.io"
    https://news.ycombinator.com/item?id=12345  ->  "news.ycombinator.com"
    (no domain) reddit_r/startups abc123  ->  "reddit_r/startups:abc123"

This function MUST produce identical output to the TypeScript version at
lib/utils/canonical-key.ts (written in Phase 6). Any drift breaks dedup.
"""

import logging
import re
from typing import Optional
from urllib.parse import urlparse

logger = logging.getLogger(__name__)


# Domains that are never the "real" startup domain — they host discussion
# pages, not company websites. When we see these, we fall through to the
# source:id fallback.
DISCUSSION_HOSTS = {
    "news.ycombinator.com",
    "reddit.com",
    "www.reddit.com",
    "old.reddit.com",
}


def canonical_key(
    url: Optional[str],
    source: str,
    source_id: Optional[str] = None,
) -> str:
    """
    Produce a canonical key for a candidate.

    Args:
        url: The raw URL from the source (may be None)
        source: Source identifier, e.g. "hackernews", "reddit_r/startups", or a feed URL
        source_id: Optional stable ID from the source (HN item id, Reddit post id)

    Returns:
        A non-empty string suitable for use as a unique key.

    Raises:
        ValueError: if neither url nor (source, source_id) can produce a key
    """
    if url:
        host = _extract_host(url)
        if host and host not in DISCUSSION_HOSTS:
            return host

    if source_id:
        return f"{source}:{source_id}"

    # Last resort: if url exists but was a discussion host, use its full path
    if url:
        parsed = urlparse(url)
        path = (parsed.path or "").strip("/")
        if path:
            return f"{source}:{path}"

    raise ValueError(
        f"Cannot build canonical key: url={url!r} source={source!r} source_id={source_id!r}"
    )


def _extract_host(url: str) -> Optional[str]:
    """
    Extract and normalize the hostname from a URL.

    Returns None if the URL is malformed or has no host.
    """
    try:
        # urlparse needs a scheme to parse correctly; prepend if missing
        if not re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*://", url):
            url = "https://" + url
        parsed = urlparse(url)
        host = parsed.hostname
        if not host:
            return None
        host = host.lower()
        if host.startswith("www."):
            host = host[4:]
        return host
    except Exception as e:
        logger.debug(f"Failed to parse URL {url!r}: {e}")
        return None


# ─── Self-test ─────────────────────────────────────────────────────

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    cases = [
        ("https://acme.io/pricing?utm=x", "hackernews", None, "acme.io"),
        ("http://www.acme.io/", "rss", None, "acme.io"),
        ("https://ACME.io", "reddit_r/startups", None, "acme.io"),
        ("https://news.ycombinator.com/item?id=12345", "hackernews", "12345", "hackernews:12345"),
        (None, "reddit_r/startups", "abc123", "reddit_r/startups:abc123"),
        ("https://blog.example.com/post/1", "rss", None, "blog.example.com"),
    ]

    failures = 0
    for url, source, source_id, expected in cases:
        try:
            got = canonical_key(url, source, source_id)
            status = "OK " if got == expected else "FAIL"
            if got != expected:
                failures += 1
            print(f"{status} {url!r:60} -> {got!r} (expected {expected!r})")
        except Exception as e:
            print(f"ERR  {url!r:60} -> {e}")
            failures += 1

    print()
    if failures == 0:
        print(f"All {len(cases)} cases passed.")
    else:
        print(f"{failures} of {len(cases)} cases FAILED.")