"""
Memory Integration — Unified interface for structured memory.

Phase 2: ChromaDB vector memory removed. This module now wraps only
structured (Postgres) memory. Method signatures are preserved from the
old version so callers don't need to change.

Removed methods (all ChromaDB-based):
- query_memory
- retrieve_context
- chat
- delete_candidate_memory
- clear_vector_memory

The `get_stats()` return shape lost its `vector` sub-dict.
"""

import logging
from typing import List, Dict, Any, Optional

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
    save_report,
    get_decision,
    get_recent_reports,
    get_recent_reports_by_days,
    get_funnel_stats,
    save_backtest_result,
    get_backtest_results,
    clear_backtest_results,
)

logger = logging.getLogger(__name__)


class MemoryIntegration:
    """
    Unified memory interface for DealFlow.

    Currently wraps structured (Postgres) memory only.
    """

    def __init__(self):
        logger.debug("MemoryIntegration initialized")

    # ─── Candidate memory ────────────────────────────────────────────

    def add_candidate(
        self,
        title: str,
        url: str,
        source: str,
        discovery_confidence: Optional[float] = None,
        raw_text: Optional[str] = None,
    ) -> Optional[str]:
        """
        Add a candidate. Returns candidate id (str) or None if duplicate.

        The raw_text parameter is retained for signature compatibility but
        is no longer used (it fed ChromaDB in the old version). It will be
        stored on Candidate.rawText in a future phase if needed.
        """
        if is_already_seen(url):
            logger.debug(f"Candidate already seen: {url}")
            return None

        return add_seen_candidate(
            title=title,
            url=url,
            source=source,
            discovery_confidence=discovery_confidence,
        )

    def get_candidate(self, candidate_id: str) -> Optional[Dict[str, Any]]:
        return get_candidate_by_id(candidate_id)

    def get_candidate_by_url(self, url: str) -> Optional[Dict[str, Any]]:
        return get_candidate_by_url(url)

    def get_recent_candidates(
        self, limit: int = 50, days_back: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        return get_recent_candidates(limit, days_back)

    def is_seen(self, url: str) -> bool:
        return is_already_seen(url)

    # ─── Dossier memory ──────────────────────────────────────────────

    def save_dossier(
        self, candidate_id: str, dossier_json: Dict[str, Any]
    ) -> str:
        return save_dossier(candidate_id, dossier_json)

    def get_dossier(self, dossier_id: str) -> Optional[Dict[str, Any]]:
        return get_dossier(dossier_id)

    def get_latest_dossier(self, candidate_id: str) -> Optional[Dict[str, Any]]:
        return get_latest_dossier_for_candidate(candidate_id)

    def get_recent_dossiers(self, limit: int = 10) -> List[Dict[str, Any]]:
        return get_recent_dossiers(limit)

    # ─── Decision memory ─────────────────────────────────────────────

    def save_decision(
        self,
        dossier_id: str,
        decision: str,
        weighted_score: float,
        fast_path: Optional[str] = None,
        round1_opinions: Optional[List[Dict[str, Any]]] = None,
        round2_opinions: Optional[List[Dict[str, Any]]] = None,
        debate_summary: Optional[str] = None,
    ) -> str:
        return save_decision(
            dossier_id=dossier_id,
            decision=decision,
            weighted_score=weighted_score,
            fast_path=fast_path,
            round1_opinions=round1_opinions,
            round2_opinions=round2_opinions,
            debate_summary=debate_summary,
        )

    def get_decision(self, dossier_id: str) -> Optional[Dict[str, Any]]:
        return get_decision(dossier_id)

    def get_recent_reports(self, limit: int = 10) -> List[Dict[str, Any]]:
        return get_recent_reports(limit)

    def get_recent_reports_by_days(self, days: int = 7) -> List[Dict[str, Any]]:
        return get_recent_reports_by_days(days)

    # ─── Report memory ───────────────────────────────────────────────

    def save_report(
        self,
        candidate_id: str,
        dossier_id: Optional[str],
        decision_id: Optional[str],
        report_json: Dict[str, Any],
        schema_version: str = "1.0",
    ) -> str:
        return save_report(
            candidate_id=candidate_id,
            dossier_id=dossier_id,
            decision_id=decision_id,
            report_json=report_json,
            schema_version=schema_version,
        )

    # ─── Backtest memory ─────────────────────────────────────────────

    def save_backtest_result(
        self,
        startup_name: str,
        actual_outcome: str,
        committee_verdict: str,
        aligned_with_outcome: bool,
        dossier_text: str,
    ) -> str:
        return save_backtest_result(
            startup_name=startup_name,
            actual_outcome=actual_outcome,
            committee_verdict=committee_verdict,
            aligned_with_outcome=aligned_with_outcome,
            dossier_text=dossier_text,
        )

    def get_backtest_results(self) -> Dict[str, Any]:
        return get_backtest_results()

    def clear_backtest_results(self):
        return clear_backtest_results()

    # ─── Funnel statistics ───────────────────────────────────────────

    def get_funnel_stats(self, days_back: int = 7) -> Dict[str, Any]:
        return get_funnel_stats(days_back)

    # ─── Memory statistics ───────────────────────────────────────────

    def get_stats(self) -> Dict[str, Any]:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) AS n FROM candidates")
                candidates_count = cur.fetchone()["n"]

                cur.execute("SELECT COUNT(*) AS n FROM dossiers")
                dossiers_count = cur.fetchone()["n"]

                cur.execute("SELECT COUNT(*) AS n FROM committee_decisions")
                decisions_count = cur.fetchone()["n"]

                cur.execute(
                    "SELECT COUNT(*) AS n FROM reports WHERE \"subjectType\" = 'backtest'"
                )
                backtest_count = cur.fetchone()["n"]

        return {
            "structured": {
                "candidates": candidates_count,
                "dossiers": dossiers_count,
                "decisions": decisions_count,
                "backtest_results": backtest_count,
            },
            "total": {
                "candidates": candidates_count,
                "dossiers": dossiers_count,
                "decisions": decisions_count,
            },
        }

    # ─── Composite helpers (kept for compatibility) ──────────────────

    def get_candidate_with_dossier(
        self, candidate_id: str
    ) -> Optional[Dict[str, Any]]:
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

    def get_full_report(self, candidate_id: str) -> Optional[Dict[str, Any]]:
        return self.get_candidate_with_dossier(candidate_id)


# ============================================================================
# CONVENIENCE
# ============================================================================

def get_memory_integration() -> MemoryIntegration:
    return MemoryIntegration()