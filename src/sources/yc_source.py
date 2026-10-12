"""
Y Combinator source — pulls recently funded startups from YC's public
company directory.

Uses the community-maintained yc-oss API (yc-oss.github.io), which
mirrors YC's own companies page as a single JSON file. Updated monthly,
no API key required.

YC companies have much higher base rates of real investability than
HN/Reddit/RSS — they've been selected by YC, funded, and are shipping.
"""

import logging
from typing import List, Dict, Any

import requests

logger = logging.getLogger(__name__)


YC_ALL_COMPANIES_URL = "https://yc-oss.github.io/api/companies/all.json"

# Which YC batches count as "recent"
RECENT_BATCHES = {"Winter 2026", "Fall 2025", "Summer 2025"}

# How many companies to fetch per run
MAX_COMPANIES = 30


def _fetch_all_companies() -> List[Dict[str, Any]]:
    """
    Fetch the full YC company list from the yc-oss JSON mirror.
    Returns an empty list on any failure (the pipeline continues
    with other sources).
    """
    try:
        response = requests.get(YC_ALL_COMPANIES_URL, timeout=20)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.warning(f"YC company fetch failed: {e}")
        return []


def get_yc_candidates(limit: int = MAX_COMPANIES) -> List[Dict[str, Any]]:
    """
    Fetch recent YC companies and format them as discovery candidates.

    Each candidate follows the same shape as HN/Reddit/RSS:
        {
            "title": str,
            "url": str,
            "source": "yc",
            "metadata": {...},
            "raw_text": str,
        }
    """
    logger.info("Fetching YC companies...")

    companies = _fetch_all_companies()
    if not companies:
        logger.info("  YC: 0 companies returned")
        return []

    # Filter to recent batches
    recent = [c for c in companies if c.get("batch") in RECENT_BATCHES]
    logger.info(f"  YC: {len(recent)} companies in recent batches")

    candidates: List[Dict[str, Any]] = []
    for company in recent[:limit]:
        name = (company.get("name") or "").strip()
        one_liner = (company.get("one_liner") or "").strip()
        website = (company.get("website") or "").strip()
        batch = (company.get("batch") or "").strip()
        team_size = company.get("team_size")
        industry = (company.get("industry") or "").strip()
        location = (company.get("all_locations") or "").strip()
        description = (company.get("long_description") or "").strip()

        if not name or not website:
            continue

        if not website.startswith("http"):
            website = f"https://{website}"

        raw_text = (
            f"Company: {name}\n"
            f"Batch: YC {batch}\n"
            f"Industry: {industry}\n"
            f"Team size: {team_size}\n"
            f"Location: {location}\n"
            f"One-liner: {one_liner}\n"
            f"Description: {description[:500]}\n"
            f"URL: {website}\n"
        )

        candidates.append(
            {
                "title": name,
                "url": website,
                "source": "yc",
                "metadata": {
                    "batch": batch,
                    "team_size": team_size,
                    "one_liner": one_liner,
                    "industry": industry,
                    "location": location,
                },
                "raw_text": raw_text,
            }
        )

    logger.info(f"  YC: {len(candidates)} candidates returned")
    return candidates


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    results = get_yc_candidates(limit=10)
    print(f"\nFound {len(results)} YC candidates:")
    for r in results[:10]:
        print(f"  - {r['title'][:35]:35} | {r['metadata']['batch']:12} | {r['url'][:40]}")