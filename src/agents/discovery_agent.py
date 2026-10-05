# src/agents/discovery_agent.py
"""
Discovery Agent — Classifies raw candidates from sources.

Takes candidate data from Hacker News, Reddit, and RSS feeds,
classifies whether each is a real startup worth investigating,
and assigns an initial confidence score.

Batch processing is used for efficiency (multiple candidates per LLM call).
"""

import logging
import json
from typing import List, Dict, Any, Optional, Tuple

from src.llm.client import call_llm_batch_json
from src.memory.structured_memory import add_seen_candidate, is_already_seen
from src.sources.hackernews_source import get_show_hn_posts
from src.sources.reddit_source import get_reddit_posts
from src.sources.rss_source import get_rss_candidates

from config.settings import DISCOVERY_BATCH_SIZE

logger = logging.getLogger(__name__)


# ============================================================================
# DISCOVERY SYSTEM PROMPT
# ============================================================================

DISCOVERY_SYSTEM_PROMPT = """You are a Discovery Agent for DealFlow, an autonomous VC analyst system.

Your job is to analyze startup candidates from various sources and determine:
1. Is this a real startup company worth investigating?
2. How promising is it on a scale of 1-10?

Consider these factors:
- Is there a real product or service being built?
- Is there a business model or monetization plan?
- Is the team credible (founders, advisors)?
- Is there a clear problem being solved?
- Is the market size significant?

Filter out:
- Pure opinion pieces or news articles about other companies
- Personal blogs or diaries
- Job postings or hiring announcements
- Obvious scams or spam
- Products that are just features, not companies

Respond with valid JSON in this exact format:
{
    "is_real_startup": true/false,
    "reasoning": "brief explanation of your decision",
    "initial_confidence": 1-10 (how promising it seems)
}

If uncertain, err on the side of including the candidate (false positive is better than false negative).
"""


# ============================================================================
# DISCOVERY AGENT CLASS
# ============================================================================

class DiscoveryAgent:
    """
    Discovery Agent for classifying startup candidates.
    """
    
    def __init__(self, batch_size: int = DISCOVERY_BATCH_SIZE):
        self.batch_size = batch_size
    
    def classify_batch(self, candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Classify a batch of candidates using LLM.
        
        Args:
            candidates: List of candidate dicts with 'raw_text' field
            
        Returns:
            List of candidates with classification added:
            {
                "title": "...",
                "url": "...",
                "source": "...",
                "metadata": {...},
                "raw_text": "...",
                "is_real_startup": True/False,
                "reasoning": "...",
                "initial_confidence": 7
            }
        """
        if not candidates:
            logger.info("No candidates to classify")
            return []
        
        logger.info(f"Classifying {len(candidates)} candidates...")
        
        # Prepare prompts
        prompts = []
        for candidate in candidates:
            prompt = f"""Analyze this startup candidate:

{candidate['raw_text']}

Is this a real startup worth investigating? If yes, rate its promise from 1-10.
Respond with JSON only."""
            prompts.append(prompt)
        
        try:
            # Batch call to LLM
            responses = call_llm_batch_json(
                prompts=prompts,
                system_prompt=DISCOVERY_SYSTEM_PROMPT,
                temperature=0.3,  # Lower temperature for consistent classification
                max_tokens=300,
            )
        except Exception as e:
            logger.error(f"LLM batch classification failed: {e}")
            # Fallback: mark all as non-startups
            for candidate in candidates:
                candidate["is_real_startup"] = False
                candidate["reasoning"] = "Classification failed"
                candidate["initial_confidence"] = 0
            return candidates
        
        # Apply classifications
        classified_candidates = []
        for candidate, response in zip(candidates, responses):
            try:
                is_real = response.get("is_real_startup", False)
                reasoning = response.get("reasoning", "No reasoning provided")
                confidence = response.get("initial_confidence", 5)
                
                # Clamp confidence to 1-10
                confidence = max(1, min(10, confidence))
                
                candidate["is_real_startup"] = is_real
                candidate["reasoning"] = reasoning
                candidate["initial_confidence"] = confidence
                
                if is_real:
                    classified_candidates.append(candidate)
                    logger.debug(f"✅ Found startup: {candidate['title']} (confidence: {confidence})")
                else:
                    logger.debug(f"❌ Rejected: {candidate['title']} - {reasoning}")
                    
            except Exception as e:
                logger.error(f"Failed to parse classification for {candidate.get('title', 'Unknown')}: {e}")
                candidate["is_real_startup"] = False
                candidate["reasoning"] = "Parsing error"
                candidate["initial_confidence"] = 0
        
        logger.info(f"Found {len(classified_candidates)} real startups out of {len(candidates)} candidates")
        return classified_candidates
    
    def run_discovery(self) -> List[Dict[str, Any]]:
        """
        Run the full discovery pipeline:
        1. Pull from all sources
        2. Deduplicate against seen candidates
        3. Classify candidates
        4. Store seen candidates in database
        
        Returns:
            List of classified, deduplicated candidates ready for validation
        """
        logger.info("=" * 50)
        logger.info("RUNNING DISCOVERY PIPELINE")
        logger.info("=" * 50)
        
        # Step 1: Pull from all sources
        raw_candidates = self._pull_from_sources()
        logger.info(f"Pulled {len(raw_candidates)} raw candidates from all sources")
        
        # Step 2: Deduplicate
        new_candidates = self._deduplicate(raw_candidates)
        logger.info(f"Deduplicated: {len(new_candidates)} new candidates")
        
        if not new_candidates:
            logger.info("No new candidates to classify")
            return []
        
        # Step 3: Classify
        classified = self.classify_batch(new_candidates)
        
        # Step 4: Store seen candidates in database
        self._store_seen_candidates(classified)
        
        logger.info(f"Discovery complete: {len(classified)} candidates classified as startups")
        return classified
    
    def _pull_from_sources(self) -> List[Dict[str, Any]]:
        """
        Pull candidates from all configured sources.
        
        Returns:
            List of raw candidate dicts with 'raw_text' field
        """
        all_candidates = []
        
        # Hacker News - Show HN posts
        try:
            hn_posts = get_show_hn_posts(limit=50, max_hours_back=48)
            all_candidates.extend(hn_posts)
            logger.info(f"  Hacker News: {len(hn_posts)} posts")
        except Exception as e:
            logger.error(f"  Hacker News failed: {e}")
        
        # Reddit - startup subreddits
        try:
            reddit_posts = get_reddit_posts(limit=15, max_hours_back=48)
            all_candidates.extend(reddit_posts)
            logger.info(f"  Reddit: {len(reddit_posts)} posts")
        except Exception as e:
            logger.error(f"  Reddit failed: {e}")
        
        # RSS feeds
        try:
            rss_posts = get_rss_candidates(max_entries=10, max_hours_back=48, filter_relevant=True)
            all_candidates.extend(rss_posts)
            logger.info(f"  RSS: {len(rss_posts)} entries")
        except Exception as e:
            logger.error(f"  RSS failed: {e}")
        
        return all_candidates
    
    def _deduplicate(self, candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Remove candidates that have already been seen.
        
        Uses URL as the unique identifier.
        """
        new_candidates = []
        seen_count = 0
        
        for candidate in candidates:
            url = candidate.get("url", "")
            if not url:
                logger.warning(f"Candidate without URL: {candidate.get('title', 'Unknown')}")
                continue
            
            if is_already_seen(url):
                seen_count += 1
                logger.debug(f"Duplicate skipped: {url}")
                continue
            
            new_candidates.append(candidate)
        
        if seen_count > 0:
            logger.info(f"  Skipped {seen_count} duplicates")
        
        return new_candidates
    
    def _store_seen_candidates(self, candidates: List[Dict[str, Any]]):
        """
        Store seen candidates in the database.
        """
        for candidate in candidates:
            candidate_id = add_seen_candidate(
                title=candidate.get("title", "Unknown"),
                url=candidate.get("url", ""),
                source=candidate.get("source", "unknown"),
                discovery_confidence=candidate.get("initial_confidence", 5.0)
            )
            if candidate_id:
                # Store the ID for later reference
                candidate["db_id"] = candidate_id
                logger.debug(f"  Stored: {candidate['title']} (ID: {candidate_id})")
            else:
                logger.warning(f"  Failed to store: {candidate.get('title', 'Unknown')}")


# ============================================================================
# CONVENIENCE FUNCTIONS
# ============================================================================

def run_discovery_pipeline() -> List[Dict[str, Any]]:
    """
    Convenience function to run the full discovery pipeline.
    
    Returns:
        List of classified candidates ready for validation
    """
    agent = DiscoveryAgent()
    return agent.run_discovery()


def quick_classify(candidate: Dict[str, Any]) -> Dict[str, Any]:
    """
    Quick single-candidate classification (for testing).
    
    Args:
        candidate: Candidate dict with 'raw_text' field
        
    Returns:
        Candidate with classification added
    """
    agent = DiscoveryAgent()
    results = agent.classify_batch([candidate])
    return results[0] if results else candidate


# ============================================================================
# TESTING
# ============================================================================

if __name__ == "__main__":
    # Quick test
    logging.basicConfig(level=logging.INFO)
    
    print("\n🔍 Testing Discovery Agent...")
    
    # Create a test candidate
    test_candidate = {
        "title": "Test Startup - AI for Legal Research",
        "url": "https://test-startup.com",
        "source": "test",
        "raw_text": """
Title: Test Startup - AI for Legal Research
Author: johndoe
Source: test
Description: We're building an AI platform that helps law firms 
research cases 10x faster. Founded by 2 ex-lawyers and a machine 
learning engineer. Currently in private beta with 5 law firms.
URL: https://test-startup.com
"""
    }
    
    # Run discovery on test candidate
    agent = DiscoveryAgent()
    results = agent.classify_batch([test_candidate])
    
    if results:
        result = results[0]
        print(f"\n✅ Classification result:")
        print(f"  Title: {result['title']}")
        print(f"  Is Real Startup: {result.get('is_real_startup', False)}")
        print(f"  Confidence: {result.get('initial_confidence', 0)}/10")
        print(f"  Reasoning: {result.get('reasoning', 'N/A')}")
    else:
        print("\n❌ Classification failed")
    
    # Test full pipeline (if you want to run against real sources)
    print("\n" + "=" * 50)
    print("Full discovery pipeline (real sources):")
    print("=" * 50)
    candidates = run_discovery_pipeline()
    print(f"\n✅ Pipeline complete: {len(candidates)} candidates found")
    
    for i, candidate in enumerate(candidates[:3], 1):
        print(f"  {i}. {candidate['title'][:50]}... (conf: {candidate.get('initial_confidence', 0)}/10)")