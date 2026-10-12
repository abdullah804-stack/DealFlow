"""
Canonical key parity test — Python side.

Outputs a canonical JSON block that the CI job compares against
tests/canonical_parity.ts. Any drift between the two implementations
breaks deduplication across the discovery pipeline (Python) and the
idea-evaluation pipeline (TS).
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.memory.canonical_key import canonical_key


CASES = [
    {"url": "https://acme.io/pricing?utm=x", "source": "hackernews", "sourceId": None},
    {"url": "http://www.acme.io/", "source": "rss", "sourceId": None},
    {"url": "https://ACME.io", "source": "reddit_r/startups", "sourceId": None},
    {"url": "https://blog.example.com/post/1", "source": "rss", "sourceId": None},
    {"url": "acme.io", "source": "rss", "sourceId": None},
    {"url": "https://news.ycombinator.com/item?id=12345", "source": "hackernews", "sourceId": "12345"},
    {"url": None, "source": "reddit_r/startups", "sourceId": "abc123"},
    {"url": "https://www.example.co.uk/product/42", "source": "rss", "sourceId": None},
]


def main() -> None:
    results = []
    for case in CASES:
        try:
            key = canonical_key(
                url=case["url"],
                source=case["source"],
                source_id=case["sourceId"],
            )
            results.append({"input": case, "key": key, "error": None})
        except Exception as e:
            results.append({"input": case, "key": None, "error": str(e)})

    print("CANONICAL_PARITY_JSON_START")
    print(json.dumps(results, sort_keys=True, indent=2))
    print("CANONICAL_PARITY_JSON_END")


if __name__ == "__main__":
    main()