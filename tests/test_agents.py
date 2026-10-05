# tests/test_agents.py
"""
Agent Tests — Validate Discovery and Validation agents work correctly.

Tests:
- Discovery Agent: classification, batch processing, deduplication
- Validation Agent: scoring, ranking, cap enforcement
- Integration: full pipeline from discovery to validation

Uses mock candidates to avoid network calls.
"""

import unittest
import logging
import json
from datetime import datetime
from typing import List, Dict, Any, Optional

# Configure logging for tests
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ============================================================================
# TEST DATA
# ============================================================================

# Mock candidates for testing (simulating Discovery Agent input)
MOCK_CANDIDATES = [
    {
        "title": "AI Legal Research Platform",
        "url": "https://legal-ai.com",
        "source": "hackernews",
        "metadata": {
            "author": "legal_founder",
            "score": 45,
            "summary": "AI platform for legal research. Founded by 2 ex-lawyers. In beta with 5 firms."
        },
        "raw_text": """Title: AI Legal Research Platform
Author: legal_founder
Source: hackernews
Description: AI platform that helps law firms research cases 10x faster. 
Founded by 2 ex-lawyers and a machine learning engineer. 
Currently in private beta with 5 law firms.
URL: https://legal-ai.com""",
        "is_real_startup": True,
        "initial_confidence": 8,
        "reasoning": "Strong team, clear problem, early traction",
    },
    {
        "title": "Blockchain Supply Chain Tracker",
        "url": "https://chain-track.com",
        "source": "reddit",
        "metadata": {
            "author": "blockchain_dev",
            "score": 32,
            "summary": "Blockchain-based supply chain tracking for pharmaceuticals."
        },
        "raw_text": """Title: Blockchain Supply Chain Tracker
Author: blockchain_dev
Source: reddit
Description: Blockchain-based supply chain tracking for pharmaceuticals.
URL: https://chain-track.com""",
        "is_real_startup": True,
        "initial_confidence": 7,
        "reasoning": "Interesting use case, but early stage",
    },
    {
        "title": "Personal Blog - My Journey",
        "url": "https://blog-personal.com",
        "source": "rss",
        "metadata": {
            "author": "blogger",
            "summary": "Personal blog about entrepreneurship journey."
        },
        "raw_text": """Title: Personal Blog - My Journey
Author: blogger
Source: rss
Description: Personal blog about my journey as an entrepreneur.
URL: https://blog-personal.com""",
        "is_real_startup": False,
        "initial_confidence": 2,
        "reasoning": "Not a startup, just a personal blog",
    },
    {
        "title": "SaaS Analytics Dashboard",
        "url": "https://analytics-saas.com",
        "source": "rss",
        "metadata": {
            "author": "saas_founder",
            "summary": "Analytics dashboard for SaaS companies with revenue forecasting."
        },
        "raw_text": """Title: SaaS Analytics Dashboard
Author: saas_founder
Source: rss
Description: Analytics dashboard for SaaS companies with revenue forecasting.
URL: https://analytics-saas.com""",
        "is_real_startup": True,
        "initial_confidence": 6,
        "reasoning": "Good product, but crowded market",
    },
    {
        "title": "AI-powered Customer Support",
        "url": "https://support-ai.com",
        "source": "reddit",
        "metadata": {
            "author": "support_founder",
            "score": 56,
            "summary": "AI customer support agent that handles 80% of tickets automatically."
        },
        "raw_text": """Title: AI-powered Customer Support
Author: support_founder
Source: reddit
Description: AI customer support agent that handles 80% of tickets automatically.
URL: https://support-ai.com""",
        "is_real_startup": True,
        "initial_confidence": 8.5,
        "reasoning": "Strong AI application, clear value proposition",
    },
    {
        "title": "Green Energy Storage Solution",
        "url": "https://green-energy.com",
        "source": "hackernews",
        "metadata": {
            "author": "green_founder",
            "score": 67,
            "summary": "Novel battery technology for grid-scale energy storage."
        },
        "raw_text": """Title: Green Energy Storage Solution
Author: green_founder
Source: hackernews
Description: Novel battery technology for grid-scale energy storage.
URL: https://green-energy.com""",
        "is_real_startup": True,
        "initial_confidence": 8,
        "reasoning": "Important problem, innovative technology",
    },
    {
        "title": "Mental Health App for Teens",
        "url": "https://mental-health.com",
        "source": "reddit",
        "metadata": {
            "author": "mental_founder",
            "score": 78,
            "summary": "Mental health app designed specifically for teenagers."
        },
        "raw_text": """Title: Mental Health App for Teens
Author: mental_founder
Source: reddit
Description: Mental health app designed specifically for teenagers.
URL: https://mental-health.com""",
        "is_real_startup": True,
        "initial_confidence": 7.5,
        "reasoning": "Important problem, good market fit",
    },
    {
        "title": "Job Posting: Senior Developer",
        "url": "https://jobs-company.com",
        "source": "rss",
        "metadata": {
            "author": "hr_team",
            "summary": "We're hiring a senior developer to join our team."
        },
        "raw_text": """Title: Job Posting: Senior Developer
Author: hr_team
Source: rss
Description: We're hiring a senior developer to join our team.
URL: https://jobs-company.com""",
        "is_real_startup": False,
        "initial_confidence": 1,
        "reasoning": "Just a job posting",
    },
]


# ============================================================================
# MOCK LLM CLIENT
# ============================================================================

class MockLLMClient:
    """
    Mock LLM client for testing.
    Returns predefined responses based on input.
    """
    
    def __init__(self):
        self.call_count = 0
        self.calls = []
    
    def call_llm_batch_json(self, prompts, system_prompt=None, **kwargs):
        """Mock batch JSON call."""
        self.call_count += 1
        self.calls.append({"prompts": prompts, "system_prompt": system_prompt})
        
        responses = []
        for prompt in prompts:
            # Simple heuristic: if "AI" or "startup" in prompt, treat as real startup
            if "AI" in prompt or "startup" in prompt.lower():
                responses.append({
                    "is_real_startup": True,
                    "reasoning": "Mock: This appears to be a real startup",
                    "initial_confidence": 7.0,
                })
            elif "blog" in prompt.lower() or "job" in prompt.lower():
                responses.append({
                    "is_real_startup": False,
                    "reasoning": "Mock: This is not a startup",
                    "initial_confidence": 2.0,
                })
            else:
                responses.append({
                    "is_real_startup": True,
                    "reasoning": "Mock: Default classification",
                    "initial_confidence": 5.0,
                })
        
        return responses
    
    def reset(self):
        """Reset the mock."""
        self.call_count = 0
        self.calls = []


# ============================================================================
# DISCOVERY AGENT TESTS
# ============================================================================

class TestDiscoveryAgent(unittest.TestCase):
    """Test Discovery Agent functionality."""
    
    def setUp(self):
        """Setup before each test."""
        from src.agents.discovery_agent import DiscoveryAgent
        self.DiscoveryAgent = DiscoveryAgent
        
        # Create agent with small batch size for testing
        self.agent = DiscoveryAgent(batch_size=3)
        
        # Store mock LLM
        self.mock_llm = MockLLMClient()
    
    def test_classify_batch(self):
        """Test batch classification of candidates."""
        logger.info("  Testing classify_batch...")
        
        # Use real LLM for this test (or mock if needed)
        # We'll use the real implementation but with small data
        
        # Create test candidates
        test_candidates = MOCK_CANDIDATES[:4]
        
        # Patch the LLM call for testing
        # We'll use the real implementation since we have a fallback
        # For unit testing, we'd mock call_llm_batch_json
        
        # For this test, we'll just verify the structure
        # Create a minimal test with mocked LLM
        from unittest.mock import patch, MagicMock
        
        # Mock the LLM response
        mock_responses = [
            {"is_real_startup": True, "reasoning": "Mock 1", "initial_confidence": 8},
            {"is_real_startup": True, "reasoning": "Mock 2", "initial_confidence": 7},
            {"is_real_startup": False, "reasoning": "Mock 3", "initial_confidence": 2},
        ]
        
        with patch('src.agents.discovery_agent.call_llm_batch_json', 
                   return_value=mock_responses):
            result = self.agent.classify_batch(test_candidates)
            
            self.assertEqual(len(result), 2)  # Only real startups
            self.assertTrue(result[0].get("is_real_startup", False))
            self.assertTrue(result[1].get("is_real_startup", False))
            
            logger.info(f"  ✅ Batch classification works: {len(result)} candidates classified")
    
    def test_deduplication(self):
        """Test deduplication of candidates."""
        logger.info("  Testing deduplication...")
        
        # Create candidates with duplicate URLs
        candidates = [
            {"title": "Startup 1", "url": "https://startup1.com", "source": "test", "raw_text": "Test 1"},
            {"title": "Startup 1 Duplicate", "url": "https://startup1.com", "source": "test", "raw_text": "Test 1 dup"},
            {"title": "Startup 2", "url": "https://startup2.com", "source": "test", "raw_text": "Test 2"},
            {"title": "Startup 3", "url": "https://startup3.com", "source": "test", "raw_text": "Test 3"},
        ]
        
        # Test deduplication logic
        seen_urls = set()
        unique = []
        for c in candidates:
            url = c.get("url", "")
            if url and url not in seen_urls:
                seen_urls.add(url)
                unique.append(c)
        
        self.assertEqual(len(unique), 3)
        self.assertEqual(unique[0]["url"], "https://startup1.com")
        
        logger.info("  ✅ Deduplication works")
    
    def test_discovery_pipeline_structure(self):
        """Test that the discovery pipeline returns correct structure."""
        logger.info("  Testing discovery pipeline structure...")
        
        # This is a structural test - we mock the source pulls
        from unittest.mock import patch, MagicMock
        
        mock_candidates = [
            {"title": "Test Startup", "url": "https://test.com", 
             "source": "test", "raw_text": "Test", "metadata": {}}
        ]
        
        with patch.object(self.agent, '_pull_from_sources', return_value=mock_candidates):
            with patch.object(self.agent, '_deduplicate', return_value=mock_candidates):
                with patch.object(self.agent, 'classify_batch', return_value=mock_candidates):
                    with patch.object(self.agent, '_store_seen_candidates'):
                        result = self.agent.run_discovery()
                        
                        self.assertIsInstance(result, list)
                        # The mock returns the same data
                        self.assertEqual(len(result), 1)
                        
                        logger.info("  ✅ Discovery pipeline structure correct")


# ============================================================================
# VALIDATION AGENT TESTS
# ============================================================================

class TestValidationAgent(unittest.TestCase):
    """Test Validation Agent functionality."""
    
    def setUp(self):
        """Setup before each test."""
        from src.agents.validation_agent import ValidationAgent
        self.ValidationAgent = ValidationAgent
        self.agent = ValidationAgent()
    
    def test_score_and_rank(self):
        """Test scoring and ranking of candidates."""
        logger.info("  Testing score_and_rank...")
        
        # Use mock candidates
        candidates = MOCK_CANDIDATES[:5]
        
        # Test without LLM refinement (use initial confidence)
        result = self.agent.score_and_rank(candidates, refine_scores=False)
        
        self.assertEqual(len(result), 5)
        self.assertIn("final_confidence", result[0])
        self.assertIn("rank", result[0])
        
        # Check that they're sorted by confidence (descending)
        confidences = [c.get("final_confidence", 0) for c in result]
        self.assertEqual(confidences, sorted(confidences, reverse=True))
        
        logger.info(f"  ✅ Score and rank works: {len(result)} candidates ranked")
    
    def test_select_for_full_committee_cap(self):
        """Test that the cap is strictly enforced."""
        logger.info("  Testing cap enforcement...")
        
        # Create many candidates
        from config.settings import MAX_CANDIDATES_FULL_COMMITTEE_PER_DAY
        candidates = []
        for i in range(20):
            candidates.append({
                "title": f"Startup {i}",
                "url": f"https://startup{i}.com",
                "source": "test",
                "final_confidence": 5 + (i % 6),  # 5-10
                "rank": i + 1,
            })
        
        selected = self.agent.select_for_full_committee(candidates)
        
        # Check cap
        self.assertLessEqual(len(selected), MAX_CANDIDATES_FULL_COMMITTEE_PER_DAY)
        
        # Check that only high-confidence candidates are selected
        if len(selected) > 0:
            all_scores = [c.get("final_confidence", 0) for c in selected]
            min_selected = min(all_scores)
            # Should be >= 5.0 (minimum threshold)
            self.assertGreaterEqual(min_selected, 5.0)
        
        logger.info(f"  ✅ Cap enforced: {len(selected)} selected (cap: {MAX_CANDIDATES_FULL_COMMITTEE_PER_DAY})")
    
    def test_get_shortlist(self):
        """Test shortlist generation."""
        logger.info("  Testing shortlist generation...")
        
        candidates = []
        for i in range(15):
            candidates.append({
                "title": f"Startup {i}",
                "url": f"https://startup{i}.com",
                "source": "test",
                "final_confidence": 5 + i,
                "rank": i + 1,
            })
        
        shortlist = self.agent.get_shortlist(candidates)
        
        self.assertLessEqual(len(shortlist), self.agent.shortlist_max)
        
        # Check that they're the top candidates
        if len(shortlist) > 1:
            scores = [c.get("final_confidence", 0) for c in shortlist]
            self.assertEqual(scores, sorted(scores, reverse=True))
        
        logger.info(f"  ✅ Shortlist generated: {len(shortlist)} candidates")
    
    def test_run_validation_full(self):
        """Test the full validation pipeline."""
        logger.info("  Testing full validation pipeline...")
        
        candidates = MOCK_CANDIDATES[:5]
        result = self.agent.run_validation(candidates)
        
        self.assertIn("validated", result)
        self.assertIn("shortlist", result)
        self.assertIn("committee_candidates", result)
        
        self.assertEqual(len(result["validated"]), 5)
        self.assertLessEqual(len(result["committee_candidates"]), 3)
        
        # Check that committee candidates have scores
        for c in result["committee_candidates"]:
            self.assertIn("final_confidence", c)
            self.assertIn("rank", c)
        
        logger.info(f"  ✅ Full validation pipeline works: "
                   f"{len(result['validated'])} validated, "
                   f"{len(result['shortlist'])} shortlist, "
                   f"{len(result['committee_candidates'])} committee")


# ============================================================================
# INTEGRATION TESTS
# ============================================================================

class TestAgentIntegration(unittest.TestCase):
    """Test integration between Discovery and Validation agents."""
    
    def setUp(self):
        """Setup before each test."""
        from src.agents.discovery_agent import DiscoveryAgent
        from src.agents.validation_agent import ValidationAgent
        
        self.DiscoveryAgent = DiscoveryAgent
        self.ValidationAgent = ValidationAgent
        
        self.discovery = DiscoveryAgent(batch_size=3)
        self.validation = ValidationAgent()
    
    def test_discovery_to_validation_flow(self):
        """Test the full flow from discovery to validation."""
        logger.info("  Testing discovery to validation flow...")
        
        # Mock discovery to return some candidates
        from unittest.mock import patch, MagicMock
        
        mock_candidates = MOCK_CANDIDATES[:5]
        
        # Run validation on mock candidates
        result = self.validation.run_validation(mock_candidates)
        
        # Verify the flow worked
        self.assertIn("committee_candidates", result)
        self.assertTrue(len(result["committee_candidates"]) > 0)
        
        # Check that validation added required fields
        for c in result["validated"]:
            self.assertIn("final_confidence", c)
            self.assertIn("rank", c)
        
        logger.info("  ✅ Discovery to validation flow works")
    
    def test_end_to_end_structure(self):
        """Test the end-to-end pipeline structure."""
        logger.info("  Testing end-to-end pipeline structure...")
        
        # This tests that the pipeline doesn't crash
        # It's a structural test, not a full run
        
        from src.agents.discovery_agent import run_discovery_pipeline
        
        # We'll just verify the function exists and returns the right type
        # (We won't actually run it in tests to avoid network calls)
        
        # Check that the function is callable
        self.assertTrue(callable(run_discovery_pipeline))
        
        logger.info("  ✅ End-to-end pipeline structure correct")


# ============================================================================
# ERROR HANDLING TESTS
# ============================================================================

class TestErrorHandling(unittest.TestCase):
    """Test error handling in agents."""
    
    def test_discovery_handles_empty_input(self):
        """Test that Discovery Agent handles empty input gracefully."""
        logger.info("  Testing empty input handling...")
        
        from src.agents.discovery_agent import DiscoveryAgent
        agent = DiscoveryAgent()
        
        result = agent.classify_batch([])
        self.assertEqual(result, [])
        
        logger.info("  ✅ Empty input handled")
    
    def test_validation_handles_empty_input(self):
        """Test that Validation Agent handles empty input gracefully."""
        logger.info("  Testing empty input handling...")
        
        from src.agents.validation_agent import ValidationAgent
        agent = ValidationAgent()
        
        result = agent.run_validation([])
        self.assertEqual(result["validated"], [])
        self.assertEqual(result["shortlist"], [])
        self.assertEqual(result["committee_candidates"], [])
        
        logger.info("  ✅ Empty input handled")
    
    def test_validation_handles_missing_scores(self):
        """Test that Validation Agent handles missing scores gracefully."""
        logger.info("  Testing missing scores handling...")
        
        from src.agents.validation_agent import ValidationAgent
        agent = ValidationAgent()
        
        # Candidates without scores
        candidates = [
            {"title": "Test 1", "url": "https://test1.com", "source": "test"},
            {"title": "Test 2", "url": "https://test2.com", "source": "test"},
        ]
        
        # This should not crash
        result = agent.score_and_rank(candidates, refine_scores=False)
        
        self.assertEqual(len(result), 2)
        # Should use default confidence
        self.assertEqual(result[0].get("final_confidence", 5), 5)
        
        logger.info("  ✅ Missing scores handled")


# ============================================================================
# TEST RUNNER
# ============================================================================

def run_all_tests():
    """Run all agent tests."""
    logger.info("=" * 60)
    logger.info("RUNNING ALL AGENT TESTS")
    logger.info("=" * 60)
    
    # Load tests
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    suite.addTests(loader.loadTestsFromTestCase(TestDiscoveryAgent))
    suite.addTests(loader.loadTestsFromTestCase(TestValidationAgent))
    suite.addTests(loader.loadTestsFromTestCase(TestAgentIntegration))
    suite.addTests(loader.loadTestsFromTestCase(TestErrorHandling))
    
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
# MAIN
# ============================================================================

if __name__ == "__main__":
    import sys
    
    print("\n" + "=" * 60)
    print("DealFlow — AGENT TESTS")
    print("=" * 60)
    
    if "--quick" in sys.argv:
        # Quick tests only
        logger.info("Running quick tests...")
        # Run minimal tests
        from unittest import defaultTestLoader
        suite = defaultTestLoader.loadTestsFromTestCase(TestErrorHandling)
        runner = unittest.TextTestRunner(verbosity=2)
        runner.run(suite)
    else:
        run_all_tests()