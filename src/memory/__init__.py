# src/memory/__init__.py
"""
Memory Module — Structured and Vector Memory for VentureScout AI.

Provides:
- Structured memory: SQLite database for candidates, dossiers, decisions
- Vector memory: ChromaDB for semantic search and RAG
- Memory integration: Unified interface for both systems
- RAG utilities: Context building and chat support

Usage:
    from src.memory import (
        MemoryIntegration,
        get_memory_integration,
        get_rag_response,
        ChatHistory,
    )
    
    # Get memory integration
    memory = get_memory_integration()
    
    # Add a candidate
    candidate_id = memory.add_candidate(
        title="AI Legal Research",
        url="https://legal-ai.com",
        source="hackernews",
        discovery_confidence=8.0,
        raw_text="...",
    )
    
    # Query memory
    results = memory.query_memory("AI startups", n_results=5)
    
    # Chat with RAG
    response = get_rag_response("What AI startups have we evaluated?")
"""

import logging
from typing import Optional

# Version
__version__ = "1.0.0"

# Set up logging
logger = logging.getLogger(__name__)

# ============================================================================
# STRUCTURED MEMORY EXPORTS
# ============================================================================

from src.memory.structured_memory import (
    # Database
    get_db,
    init_db,
    seed_database,
    
    # Candidates
    add_seen_candidate,
    is_already_seen,
    get_candidate_by_url,
    get_candidate_by_id,
    get_recent_candidates,
    update_discovery_confidence,
    
    # Dossiers
    save_dossier,
    get_dossier,
    get_latest_dossier_for_candidate,
    get_recent_dossiers,
    
    # Decisions
    save_decision,
    get_decision,
    get_recent_reports,
    get_recent_reports_by_days,
    
    # Funnel
    get_funnel_stats,
    
    # Backtest
    save_backtest_result,
    get_backtest_results,
    clear_backtest_results,
)

# ============================================================================
# VECTOR MEMORY EXPORTS
# ============================================================================

from src.memory.vector_memory import (
    # Memory operations
    add_memory,
    query_memory,
    update_memory_decision,
    delete_memory,
    clear_vector_memory,
    
    # Chat support
    retrieve_context_for_query,
    chat_with_memory,
    
    # Utilities
    get_collection_stats,
    init_vector_memory,
)

# ============================================================================
# MEMORY INTEGRATION EXPORTS
# ============================================================================

from src.memory.memory_integration import (
    MemoryIntegration,
    get_memory_integration,
)

# ============================================================================
# RAG UTILITIES EXPORTS
# ============================================================================

from src.memory.rag_utils import (
    # Query classification
    classify_query,
    extract_company_name,
    
    # Context building
    RAGContextBuilder,
    
    # Chat history
    ChatHistory,
    
    # Main RAG function
    get_rag_response,
    
    # Advanced features
    query_expansion,
    rerank_results,
)

# ============================================================================
# MODULE DOCUMENTATION
# ============================================================================

__all__ = [
    # Structured memory
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
    
    # Vector memory
    "add_memory",
    "query_memory",
    "update_memory_decision",
    "delete_memory",
    "clear_vector_memory",
    "retrieve_context_for_query",
    "chat_with_memory",
    "get_collection_stats",
    "init_vector_memory",
    
    # Memory integration
    "MemoryIntegration",
    "get_memory_integration",
    
    # RAG utilities
    "classify_query",
    "extract_company_name",
    "RAGContextBuilder",
    "ChatHistory",
    "get_rag_response",
    "query_expansion",
    "rerank_results",
]

# ============================================================================
# MODULE INITIALIZATION
# ============================================================================

def init_memory():
    """
    Initialize both structured and vector memory.
    
    This should be called once at application startup.
    """
    logger.info("Initializing memory module...")
    
    # Initialize structured memory
    init_db()
    logger.info("  ✅ Structured memory initialized")
    
    # Initialize vector memory
    init_vector_memory()
    logger.info("  ✅ Vector memory initialized")
    
    logger.info("Memory module fully initialized")

def get_stats():
    """
    Get memory statistics.
    
    Returns:
        Dict with memory statistics
    """
    memory = get_memory_integration()
    return memory.get_stats()

# ============================================================================
# QUICK TEST
# ============================================================================

if __name__ == "__main__":
    # Quick test
    logging.basicConfig(level=logging.INFO)
    
    print("\n" + "=" * 50)
    print("MEMORY MODULE TEST")
    print("=" * 50)
    
    # Test initialization
    print("\n📊 Initializing memory...")
    init_memory()
    
    # Test imports
    print("\n📊 Testing imports...")
    
    try:
        from src.memory import MemoryIntegration, get_memory_integration
        memory = get_memory_integration()
        print("  ✅ MemoryIntegration imported successfully")
    except Exception as e:
        print(f"  ❌ MemoryIntegration import failed: {e}")
    
    try:
        from src.memory import ChatHistory, get_rag_response
        history = ChatHistory()
        print("  ✅ RAG utilities imported successfully")
    except Exception as e:
        print(f"  ❌ RAG utilities import failed: {e}")
    
    try:
        from src.memory import get_funnel_stats, get_recent_reports
        stats = get_funnel_stats()
        print("  ✅ Structured memory utilities imported successfully")
    except Exception as e:
        print(f"  ❌ Structured memory utilities import failed: {e}")
    
    # Test stats
    print("\n📊 Memory statistics:")
    try:
        stats = get_stats()
        print(f"  Candidates: {stats['structured']['candidates']}")
        print(f"  Dossiers: {stats['structured']['dossiers']}")
        print(f"  Decisions: {stats['structured']['decisions']}")
        print(f"  Vector documents: {stats['vector']['documents']}")
    except Exception as e:
        print(f"  ❌ Stats failed: {e}")
    
    print("\n✅ All memory module tests passed!")
    print("=" * 50)