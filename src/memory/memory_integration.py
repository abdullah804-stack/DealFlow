# src/memory/memory_integration.py
"""
Memory Integration — Unified interface for structured + vector memory.

Provides:
- Single API for all memory operations
- RAG utilities for chat
- Candidate and decision memory management
- Context retrieval for queries
- Memory statistics
"""

import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta

from src.memory.structured_memory import (
    get_db,
    add_seen_candidate,
    is_already_seen,
    get_candidate_by_url,
    get_candidate_by_id,
    get_recent_candidates,
    save_dossier,
    get_dossier,
    get_latest_dossier_for_candidate,
    get_recent_dossiers,
    save_decision,
    get_decision,
    get_recent_reports,
    get_recent_reports_by_days,
    get_funnel_stats,
    save_backtest_result,
    get_backtest_results,
    clear_backtest_results,
)
from src.memory.vector_memory import (
    add_memory,
    query_memory,
    chat_with_memory,
    retrieve_context_for_query,
    update_memory_decision,
    delete_memory,
    get_collection_stats,
    clear_vector_memory,
)

logger = logging.getLogger(__name__)


# ============================================================================
# MEMORY INTEGRATION CLASS
# ============================================================================

class MemoryIntegration:
    """
    Unified memory interface for VentureScout AI.
    
    Combines structured (SQLite) and vector (ChromaDB) memory.
    """
    
    def __init__(self):
        """Initialize the memory integration."""
        logger.info("MemoryIntegration initialized")
    
    # ========================================================================
    # CANDIDATE MEMORY
    # ========================================================================
    
    def add_candidate(
        self,
        title: str,
        url: str,
        source: str,
        discovery_confidence: Optional[float] = None,
        raw_text: Optional[str] = None,
    ) -> Optional[int]:
        """
        Add a new candidate to memory.
        
        Returns:
            Candidate ID or None if duplicate
        """
        # Check if already seen
        if is_already_seen(url):
            logger.debug(f"Candidate already seen: {url}")
            return None
        
        # Add to structured memory
        candidate_id = add_seen_candidate(
            title=title,
            url=url,
            source=source,
            discovery_confidence=discovery_confidence,
        )
        
        # Add to vector memory if we have raw text
        if candidate_id and raw_text:
            try:
                add_memory(
                    candidate_id=candidate_id,
                    dossier_summary=raw_text[:500],  # Truncate for vector
                    decision="pending",
                    metadata={
                        "source": source,
                        "title": title,
                        "discovery_confidence": discovery_confidence,
                    }
                )
            except Exception as e:
                logger.warning(f"Failed to add vector memory: {e}")
        
        return candidate_id
    
    def get_candidate(self, candidate_id: int) -> Optional[Dict[str, Any]]:
        """Get a candidate by ID."""
        return get_candidate_by_id(candidate_id)
    
    def get_candidate_by_url(self, url: str) -> Optional[Dict[str, Any]]:
        """Get a candidate by URL."""
        return get_candidate_by_url(url)
    
    def get_recent_candidates(
        self,
        limit: int = 50,
        days_back: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """Get recently discovered candidates."""
        return get_recent_candidates(limit, days_back)
    
    def is_seen(self, url: str) -> bool:
        """Check if a candidate has been seen."""
        return is_already_seen(url)
    
    # ========================================================================
    # DOSSIER MEMORY
    # ========================================================================
    
    def save_dossier(
        self,
        candidate_id: int,
        dossier_json: Dict[str, Any],
    ) -> int:
        """Save a dossier to memory."""
        # Save to structured memory
        dossier_id = save_dossier(candidate_id, dossier_json)
        
        # Add to vector memory
        try:
            # Create a summary for vector memory
            summary = self._create_dossier_summary(dossier_json)
            add_memory(
                candidate_id=candidate_id,
                dossier_summary=summary,
                decision="pending",
                metadata={
                    "dossier_id": dossier_id,
                    "candidate_id": candidate_id,
                }
            )
        except Exception as e:
            logger.warning(f"Failed to add dossier to vector memory: {e}")
        
        return dossier_id
    
    def get_dossier(self, dossier_id: int) -> Optional[Dict[str, Any]]:
        """Get a dossier by ID."""
        return get_dossier(dossier_id)
    
    def get_latest_dossier(self, candidate_id: int) -> Optional[Dict[str, Any]]:
        """Get the latest dossier for a candidate."""
        return get_latest_dossier_for_candidate(candidate_id)
    
    def get_recent_dossiers(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get recent dossiers."""
        return get_recent_dossiers(limit)
    
    # ========================================================================
    # DECISION MEMORY
    # ========================================================================
    
    def save_decision(
        self,
        dossier_id: int,
        decision: str,
        weighted_score: float,
        fast_path: Optional[str] = None,
        round1_opinions: Optional[List[Dict[str, Any]]] = None,
        round2_opinions: Optional[List[Dict[str, Any]]] = None,
        debate_summary: Optional[str] = None,
    ) -> int:
        """Save a committee decision."""
        # Save to structured memory
        decision_id = save_decision(
            dossier_id=dossier_id,
            decision=decision,
            weighted_score=weighted_score,
            fast_path=fast_path,
            round1_opinions=round1_opinions,
            round2_opinions=round2_opinions,
            debate_summary=debate_summary,
        )
        
        # Update vector memory
        try:
            # Get the dossier to find candidate_id
            dossier = get_dossier(dossier_id)
            if dossier:
                candidate_id = dossier.get("candidate_id")
                if candidate_id:
                    update_memory_decision(
                        candidate_id=candidate_id,
                        decision=decision,
                        score=weighted_score,
                    )
        except Exception as e:
            logger.warning(f"Failed to update vector memory: {e}")
        
        return decision_id
    
    def get_decision(self, dossier_id: int) -> Optional[Dict[str, Any]]:
        """Get a decision by dossier ID."""
        return get_decision(dossier_id)
    
    def get_recent_reports(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get recent reports."""
        return get_recent_reports(limit)
    
    def get_recent_reports_by_days(self, days: int = 7) -> List[Dict[str, Any]]:
        """Get reports from the last N days."""
        return get_recent_reports_by_days(days)
    
    # ========================================================================
    # BACKTEST MEMORY
    # ========================================================================
    
    def save_backtest_result(
        self,
        startup_name: str,
        actual_outcome: str,
        committee_verdict: str,
        aligned_with_outcome: bool,
        dossier_text: str,
    ) -> int:
        """Save a backtest result."""
        return save_backtest_result(
            startup_name=startup_name,
            actual_outcome=actual_outcome,
            committee_verdict=committee_verdict,
            aligned_with_outcome=aligned_with_outcome,
            dossier_text=dossier_text,
        )
    
    def get_backtest_results(self) -> Dict[str, Any]:
        """Get backtest results."""
        return get_backtest_results()
    
    def clear_backtest_results(self):
        """Clear all backtest results."""
        return clear_backtest_results()
    
    # ========================================================================
    # FUNNEL STATISTICS
    # ========================================================================
    
    def get_funnel_stats(self, days_back: int = 7) -> Dict[str, Any]:
        """Get funnel statistics."""
        return get_funnel_stats(days_back)
    
    # ========================================================================
    # VECTOR MEMORY (RAG)
    # ========================================================================
    
    def query_memory(
        self,
        query: str,
        n_results: int = 5,
        filter_by_decision: Optional[str] = None,
        min_score: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        """Query vector memory semantically."""
        return query_memory(query, n_results, filter_by_decision, min_score)
    
    def retrieve_context(self, query: str, n_results: int = 3) -> str:
        """Retrieve context for a query."""
        return retrieve_context_for_query(query, n_results)
    
    def chat(self, query: str, n_results: int = 3) -> Dict[str, Any]:
        """Chat with memory using RAG."""
        return chat_with_memory(query, n_results)
    
    def delete_candidate_memory(self, candidate_id: int):
        """Delete a candidate from vector memory."""
        delete_memory(candidate_id)
    
    def clear_vector_memory(self):
        """Clear all vector memory."""
        clear_vector_memory()
    
    # ========================================================================
    # MEMORY STATISTICS
    # ========================================================================
    
    def get_stats(self) -> Dict[str, Any]:
        """Get comprehensive memory statistics."""
        # Structured stats
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Candidate count
            cursor.execute("SELECT COUNT(*) FROM seen_candidates")
            candidates_count = cursor.fetchone()[0]
            
            # Dossier count
            cursor.execute("SELECT COUNT(*) FROM dossiers")
            dossiers_count = cursor.fetchone()[0]
            
            # Decision count
            cursor.execute("SELECT COUNT(*) FROM decisions")
            decisions_count = cursor.fetchone()[0]
            
            # Backtest count
            cursor.execute("SELECT COUNT(*) FROM backtest_results")
            backtest_count = cursor.fetchone()[0]
        
        # Vector stats
        try:
            vector_stats = get_collection_stats()
        except Exception:
            vector_stats = {"document_count": 0}
        
        return {
            "structured": {
                "candidates": candidates_count,
                "dossiers": dossiers_count,
                "decisions": decisions_count,
                "backtest_results": backtest_count,
            },
            "vector": {
                "documents": vector_stats.get("document_count", 0),
            },
            "total": {
                "candidates": candidates_count,
                "dossiers": dossiers_count,
                "decisions": decisions_count,
                "vector_documents": vector_stats.get("document_count", 0),
            }
        }
    
    # ========================================================================
    # UTILITY HELPERS
    # ========================================================================
    
    def _create_dossier_summary(self, dossier: Dict[str, Any]) -> str:
        """
        Create a summary from a dossier for vector memory.
        """
        parts = []
        
        company = dossier.get("company", "Unknown")
        parts.append(f"Company: {company}")
        
        industry = dossier.get("industry", "Unknown")
        parts.append(f"Industry: {industry}")
        
        summary = dossier.get("summary", "No summary available")
        parts.append(f"Summary: {summary}")
        
        technology = dossier.get("technology", "Unknown")
        if technology != "unknown":
            parts.append(f"Technology: {technology}")
        
        competitors = dossier.get("competitors", [])
        if competitors:
            parts.append(f"Competitors: {', '.join(competitors[:3])}")
        
        funding = dossier.get("funding_status", "Unknown")
        if funding != "unknown":
            parts.append(f"Funding: {funding}")
        
        pricing = dossier.get("pricing_model", "Unknown")
        if pricing != "unknown":
            parts.append(f"Pricing: {pricing}")
        
        return "\n".join(parts)
    
    def get_candidate_with_dossier(
        self,
        candidate_id: int
    ) -> Optional[Dict[str, Any]]:
        """
        Get a candidate with their latest dossier and decision.
        """
        candidate = get_candidate_by_id(candidate_id)
        if not candidate:
            return None
        
        dossier = get_latest_dossier_for_candidate(candidate_id)
        if dossier:
            candidate["dossier"] = dossier
            decision = get_decision(dossier["id"])
            if decision:
                candidate["decision"] = decision
        
        return candidate
    
    def get_full_report(
        self,
        candidate_id: int
    ) -> Optional[Dict[str, Any]]:
        """
        Get a full report for a candidate.
        
        Includes: candidate info, dossier, decision, and debate.
        """
        result = self.get_candidate_with_dossier(candidate_id)
        if not result:
            return None
        
        # Add vector memory context if available
        try:
            # Search for related memories
            title = result.get("title", "")
            if title:
                memories = query_memory(title, n_results=3)
                if memories:
                    result["related_memories"] = memories
        except Exception as e:
            logger.warning(f"Failed to get related memories: {e}")
        
        return result


# ============================================================================
# CONVENIENCE FUNCTIONS
# ============================================================================

def get_memory_integration() -> MemoryIntegration:
    """
    Get a MemoryIntegration instance.
    """
    return MemoryIntegration()


# ============================================================================
# TESTING
# ============================================================================

if __name__ == "__main__":
    # Quick test
    logging.basicConfig(level=logging.INFO)
    
    print("\n🔍 Testing Memory Integration...")
    
    # Initialize
    memory = MemoryIntegration()
    
    # Test stats
    print("\n📊 Memory Statistics:")
    stats = memory.get_stats()
    print(f"  Candidates: {stats['structured']['candidates']}")
    print(f"  Dossiers: {stats['structured']['dossiers']}")
    print(f"  Decisions: {stats['structured']['decisions']}")
    print(f"  Vector Documents: {stats['vector']['documents']}")
    
    # Test adding a candidate
    print("\n📊 Adding test candidate...")
    candidate_id = memory.add_candidate(
        title="Test AI Startup",
        url="https://test-ai-startup.com",
        source="test",
        discovery_confidence=8.0,
        raw_text="Test AI Startup - Building AI for legal research. Founded by ex-lawyers.",
    )
    
    if candidate_id:
        print(f"  Added candidate ID: {candidate_id}")
        
        # Test dossier
        print("\n📊 Adding test dossier...")
        dossier = {
            "company": "Test AI Startup",
            "industry": "Legal Technology",
            "summary": "AI platform for legal research.",
            "pricing_model": "Subscription",
            "estimated_users": "50 firms",
            "technology": "NLP, AI",
            "competitors": ["LexisNexis"],
            "funding_status": "Pre-seed",
        }
        dossier_id = memory.save_dossier(candidate_id, dossier)
        print(f"  Added dossier ID: {dossier_id}")
        
        # Test decision
        print("\n📊 Adding test decision...")
        decision_id = memory.save_decision(
            dossier_id=dossier_id,
            decision="INVEST",
            weighted_score=7.5,
            fast_path=None,
        )
        print(f"  Added decision ID: {decision_id}")
        
        # Test chat
        print("\n📊 Testing chat...")
        chat_result = memory.chat("What AI startups have we evaluated?")
        print(f"  Response: {chat_result.get('response', '')[:100]}...")
    
    # Test funnel stats
    print("\n📊 Funnel Statistics:")
    funnel = memory.get_funnel_stats(days_back=7)
    print(f"  Discovered: {funnel['discovered']}")
    print(f"  Validated: {funnel['validated']}")
    print(f"  Escalated: {funnel['escalated']}")
    print(f"  Invested: {funnel['invested']}")
    
    print("\n✅ Memory integration tests passed!")