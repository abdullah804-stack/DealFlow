"""
Memory Module — Structured memory for DealFlow.

Postgres-only. Vector memory (ChromaDB) was removed in Phase 2.
"""

import logging

__version__ = "2.0.0"

logger = logging.getLogger(__name__)


# ============================================================================
# STRUCTURED MEMORY EXPORTS
# ============================================================================

from src.memory.structured_memory import (
    get_db,
    init_db,
    seed_database,
    add_seen_candidate,
    is_already_seen,
    get_candidate_by_url,
    get_candidate_by_id,
    get_recent_candidates,
    update_discovery_confidence,
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


# ============================================================================
# MEMORY INTEGRATION EXPORTS
# ============================================================================

from src.memory.memory_integration import (
    MemoryIntegration,
    get_memory_integration,
)


# ============================================================================
# MODULE INITIALIZATION
# ============================================================================

def init_memory():
    """
    Initialize memory. Called once at application startup.

    In Postgres mode this is a schema smoke test — the actual table
    creation is done by Prisma migrations, not Python.
    """
    logger.info("Initializing memory module...")
    init_db()
    logger.info("Memory module initialized")


def get_stats():
    memory = get_memory_integration()
    return memory.get_stats()


__all__ = [
    # Structured
    "get_db",
    "init_db",
    "seed_database",
    "add_seen_candidate",
    "is_already_seen",
    "get_candidate_by_url",
    "get_candidate_by_id",
    "get_recent_candidates",
    "update_discovery_confidence",
    "save_dossier",
    "get_dossier",
    "get_latest_dossier_for_candidate",
    "get_recent_dossiers",
    "save_decision",
    "get_decision",
    "get_recent_reports",
    "get_recent_reports_by_days",
    "get_funnel_stats",
    "save_backtest_result",
    "get_backtest_results",
    "clear_backtest_results",
    # Integration
    "MemoryIntegration",
    "get_memory_integration",
    # Helpers
    "init_memory",
    "get_stats",
]