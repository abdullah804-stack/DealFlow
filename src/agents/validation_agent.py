# src/agents/validation_agent.py
"""
Validation Agent — Scores, ranks, and selects candidates for full committee.

Takes classified candidates from Discovery Agent:
- Refines confidence scores
- Ranks candidates by potential
- Selects top candidates for full committee treatment
- Enforces MAX_CANDIDATES_FULL_COMMITTEE_PER_DAY = 3

This is a critical cost-control step that prevents LLM budget overruns.
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

from src.llm.client import call_llm_batch_json

from config.settings import (
    VALIDATION_SHORTLIST_MAX,
    MAX_CANDIDATES_FULL_COMMITTEE_PER_DAY,
)

logger = logging.getLogger(__name__)


# ============================================================================
# VALIDATION SYSTEM PROMPT
# ============================================================================

VALIDATION_SYSTEM_PROMPT = """You are a Validation Agent for DealFlow, an autonomous VC analyst system.

Your job is to refine the initial confidence scores of startup candidates and rank them by investment potential.

Given a candidate with:
- Title
- Brief description
- Initial confidence score (1-10)

Refine the score based on these VC evaluation criteria:
1. **Team quality**: Does the founder/founding team seem credible?
2. **Market opportunity**: Is the market large and growing?
3. **Product differentiation**: Is there a clear competitive advantage?
4. **Traction**: Any evidence of users, revenue, or growth?
5. **Timing**: Is this the right time for this product?

Provide:
- final_confidence: Refined score (1-10)
- reasoning: Brief explanation of your score
- recommendation: "shortlist" or "pass" (shortlist means it's worth further investigation)

Be conservative — only candidates with clear potential should receive high scores.
"""


# ============================================================================
# VALIDATION AGENT CLASS
# ============================================================================

class ValidationAgent:
    """
    Validation Agent for scoring and ranking candidates.
    """
    
    def __init__(
        self,
        shortlist_max: int = VALIDATION_SHORTLIST_MAX,
        max_for_committee: int = MAX_CANDIDATES_FULL_COMMITTEE_PER_DAY
    ):
        self.shortlist_max = shortlist_max
        self.max_for_committee = max_for_committee
    
    def score_and_rank(
        self,
        candidates: List[Dict[str, Any]],
        refine_scores: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Score and rank candidates.
        
        Args:
            candidates: List of classified candidates from Discovery Agent
            refine_scores: Whether to use LLM to refine scores
            
        Returns:
            List of candidates with scores and ranks added:
            {
                "title": "...",
                "url": "...",
                "source": "...",
                "metadata": {...},
                "initial_confidence": 7,
                "final_confidence": 8,
                "validation_reasoning": "...",
                "rank": 1
            }
        """
        if not candidates:
            logger.info("No candidates to validate")
            return []
        
        logger.info(f"Validating {len(candidates)} candidates...")
        
        # Step 1: Refine scores with LLM (optional)
        if refine_scores:
            candidates = self._refine_scores(candidates)
        else:
            # Use initial confidence as final
            for candidate in candidates:
                candidate["final_confidence"] = candidate.get("initial_confidence", 5)
                candidate["validation_reasoning"] = "Using initial confidence"
        
        # Step 2: Sort by final confidence (descending)
        candidates.sort(
            key=lambda x: x.get("final_confidence", 0),
            reverse=True
        )
        
        # Step 3: Assign ranks
        for i, candidate in enumerate(candidates, 1):
            candidate["rank"] = i
        
        # Step 4: Log results
        logger.info(f"Ranked {len(candidates)} candidates")
        for i, candidate in enumerate(candidates[:5], 1):
            logger.debug(f"  #{i}: {candidate['title'][:40]}... (score: {candidate.get('final_confidence', 0):.1f})")
        
        return candidates
    
    def _refine_scores(self, candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Use LLM to refine confidence scores.
        """
        try:
            # Prepare prompts
            prompts = []
            for candidate in candidates:
                prompt = f"""Refine the score for this startup candidate:

Title: {candidate.get('title', 'Unknown')}
Description: {candidate.get('metadata', {}).get('summary', 'No description available')}
Initial Confidence: {candidate.get('initial_confidence', 5)}/10

Provide a refined score (1-10) and brief reasoning.
Respond with JSON only:
{{
    "final_confidence": 7.5,
    "reasoning": "Strong team, growing market, but early stage",
    "recommendation": "shortlist"
}}"""
                prompts.append(prompt)
            
            # Batch call to LLM
            responses = call_llm_batch_json(
                prompts=prompts,
                system_prompt=VALIDATION_SYSTEM_PROMPT,
                temperature=0.2,
                max_tokens=300,
            )
            
            # Apply refinements
            for candidate, response in zip(candidates, responses):
                try:
                    final_conf = response.get("final_confidence", candidate.get("initial_confidence", 5))
                    # Clamp to 1-10
                    final_conf = max(1, min(10, final_conf))
                    
                    candidate["final_confidence"] = final_conf
                    candidate["validation_reasoning"] = response.get("reasoning", "No reasoning provided")
                    candidate["recommendation"] = response.get("recommendation", "pass")
                    
                except Exception as e:
                    logger.error(f"Failed to parse refinement for {candidate.get('title', 'Unknown')}: {e}")
                    candidate["final_confidence"] = candidate.get("initial_confidence", 5)
                    candidate["validation_reasoning"] = "Refinement parsing failed"
            
        except Exception as e:
            logger.error(f"Score refinement failed: {e}")
            # Fallback: use initial confidence
            for candidate in candidates:
                candidate["final_confidence"] = candidate.get("initial_confidence", 5)
                candidate["validation_reasoning"] = "Fallback: refinement failed"
        
        return candidates
    
    def select_for_full_committee(self, candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Select candidates for full committee treatment.
        
        Strictly enforces MAX_CANDIDATES_FULL_COMMITTEE_PER_DAY.
        
        Args:
            candidates: Ranked list of candidates from score_and_rank()
            
        Returns:
            List of candidates selected for full committee (max cap)
        """
        if not candidates:
            return []
        
        # Only consider candidates with final_confidence >= 5.0 (minimum threshold)
        eligible = [
            c for c in candidates
            if c.get("final_confidence", 0) >= 5.0
        ]
        
        # Select top N (enforce cap)
        selected = eligible[:self.max_for_committee]
        
        # Mark selected candidates
        for candidate in selected:
            candidate["selected_for_committee"] = True
        
        # Log selection
        logger.info(f"Selected {len(selected)} candidates for full committee")
        for i, candidate in enumerate(selected, 1):
            logger.info(f"  Selected #{i}: {candidate['title'][:50]}... (score: {candidate.get('final_confidence', 0):.1f})")
        
        # Log candidates that were not selected
        if len(eligible) > len(selected):
            logger.info(f"  {len(eligible) - len(selected)} eligible candidates not selected (cap)")
        
        return selected
    
    def get_shortlist(self, candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Get the full shortlist (top N candidates for logging).
        
        This includes candidates that didn't make the full committee cut
        but are still worth tracking.
        """
        if not candidates:
            return []
        
        # Get top shortlist_max candidates
        shortlist = candidates[:self.shortlist_max]
        
        for candidate in shortlist:
            candidate["on_shortlist"] = True
        
        return shortlist
    
    def run_validation(self, candidates: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Run the full validation pipeline.
        
        Returns:
            {
                "validated": [...],           # All validated candidates with scores
                "shortlist": [...],           # Top candidates (for logging)
                "committee_candidates": [...] # Selected for full committee
            }
        """
        if not candidates:
            logger.info("No candidates to validate")
            return {
                "validated": [],
                "shortlist": [],
                "committee_candidates": [],
            }
        
        logger.info("=" * 50)
        logger.info("RUNNING VALIDATION PIPELINE")
        logger.info("=" * 50)
        
        # Step 1: Score and rank
        validated = self.score_and_rank(candidates)
        logger.info(f"Validated {len(validated)} candidates")
        
        # Step 2: Get shortlist
        shortlist = self.get_shortlist(validated)
        logger.info(f"Shortlist: {len(shortlist)} candidates")
        
        # Step 3: Select for full committee
        committee_candidates = self.select_for_full_committee(validated)
        logger.info(f"Committee candidates: {len(committee_candidates)} candidates")
        
        return {
            "validated": validated,
            "shortlist": shortlist,
            "committee_candidates": committee_candidates,
        }


# ============================================================================
# CONVENIENCE FUNCTIONS
# ============================================================================

def run_validation_pipeline(
    candidates: List[Dict[str, Any]],
    refine_scores: bool = True
) -> Dict[str, Any]:
    """
    Convenience function to run the full validation pipeline.
    
    Args:
        candidates: Classified candidates from Discovery Agent
        refine_scores: Whether to use LLM to refine scores
        
    Returns:
        Validation results with validated, shortlist, and committee candidates
    """
    agent = ValidationAgent()
    return agent.run_validation(candidates)


def quick_validate(candidate: Dict[str, Any]) -> Dict[str, Any]:
    """
    Quick single-candidate validation (for testing).
    
    Args:
        candidate: Classified candidate
        
    Returns:
        Candidate with validation scores added
    """
    agent = ValidationAgent()
    results = agent.score_and_rank([candidate], refine_scores=True)
    return results[0] if results else candidate


# ============================================================================
# CAP ENFORCEMENT TEST
# ============================================================================

def test_cap_enforcement():
    """
    Test that the cap is strictly enforced.
    
    Creates a fake list of candidates and ensures no more than
    MAX_CANDIDATES_FULL_COMMITTEE_PER_DAY are selected.
    """
    logger.info("Testing cap enforcement...")
    
    # Create fake candidates
    fake_candidates = []
    for i in range(20):
        fake_candidates.append({
            "title": f"Test Startup {i}",
            "url": f"https://test-{i}.com",
            "source": "test",
            "initial_confidence": 5 + (i % 5),  # 5-9
            "final_confidence": 5 + (i % 5),
            "rank": i + 1,
        })
    
    # Validate
    agent = ValidationAgent()
    selected = agent.select_for_full_committee(fake_candidates)
    
    # Check cap
    max_cap = MAX_CANDIDATES_FULL_COMMITTEE_PER_DAY
    if len(selected) <= max_cap:
        logger.info(f"✅ Cap enforcement works: selected {len(selected)} candidates (cap: {max_cap})")
        return True
    else:
        logger.error(f"❌ Cap enforcement FAILED: selected {len(selected)} (cap: {max_cap})")
        return False


# ============================================================================
# TESTING
# ============================================================================

if __name__ == "__main__":
    # Quick test
    logging.basicConfig(level=logging.INFO)
    
    print("\n🔍 Testing Validation Agent...")
    
    # Test 1: Cap enforcement
    print("\n📊 Test 1: Cap Enforcement")
    test_cap_enforcement()
    
    # Test 2: Full validation on mock data
    print("\n📊 Test 2: Full Validation Pipeline")
    
    # Create mock candidates (simulating Discovery Agent output)
    mock_candidates = [
        {
            "title": "AI Legal Research Platform",
            "url": "https://legal-ai.com",
            "source": "hackernews",
            "metadata": {"summary": "AI platform for legal research. Founded by 2 ex-lawyers. In beta with 5 firms."},
            "raw_text": "AI Legal Research Platform - Helping lawyers research cases 10x faster.",
            "initial_confidence": 8,
            "is_real_startup": True,
        },
        {
            "title": "Blockchain Supply Chain Tracker",
            "url": "https://chain-track.com",
            "source": "reddit",
            "metadata": {"summary": "Blockchain-based supply chain tracking for pharmaceuticals."},
            "raw_text": "Blockchain Supply Chain Tracker - Tracking pharmaceuticals from factory to patient.",
            "initial_confidence": 7,
            "is_real_startup": True,
        },
        {
            "title": "Personal Blog - My Journey",
            "url": "https://blog-personal.com",
            "source": "rss",
            "metadata": {"summary": "Personal blog about entrepreneurship journey."},
            "raw_text": "Personal Blog - My journey as an entrepreneur.",
            "initial_confidence": 3,
            "is_real_startup": False,
        },
        {
            "title": "SaaS Analytics Dashboard",
            "url": "https://analytics-saas.com",
            "source": "rss",
            "metadata": {"summary": "Analytics dashboard for SaaS companies with revenue forecasting."},
            "raw_text": "SaaS Analytics Dashboard - Revenue forecasting for subscription businesses.",
            "initial_confidence": 6,
            "is_real_startup": True,
        },
        {
            "title": "AI-powered Customer Support",
            "url": "https://support-ai.com",
            "source": "reddit",
            "metadata": {"summary": "AI customer support agent that handles 80% of tickets automatically."},
            "raw_text": "AI-powered Customer Support - Automating 80% of support tickets.",
            "initial_confidence": 8.5,
            "is_real_startup": True,
        },
    ]
    
    # Run validation
    agent = ValidationAgent()
    results = agent.run_validation(mock_candidates)
    
    print(f"\n✅ Validation complete:")
    print(f"  Validated: {len(results['validated'])} candidates")
    print(f"  Shortlist: {len(results['shortlist'])} candidates")
    print(f"  Committee: {len(results['committee_candidates'])} candidates")
    
    print("\n📊 Committee Candidates:")
    for i, candidate in enumerate(results['committee_candidates'], 1):
        print(f"  {i}. {candidate['title'][:40]}... (score: {candidate.get('final_confidence', 0):.1f})")
    
    print("\n📊 Shortlist (remaining candidates):")
    shortlist_names = [c['title'][:30] + "..." for c in results['shortlist'] 
                       if c not in results['committee_candidates']]
    for i, name in enumerate(shortlist_names[:3], 1):
        print(f"  {i}. {name}")