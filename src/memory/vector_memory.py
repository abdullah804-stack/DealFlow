# src/memory/vector_memory.py
"""
Vector Memory — ChromaDB for semantic search and retrieval.

Provides:
- Dossier embeddings for semantic similarity search
- Memory storage for the chat interface
- Retrieval of similar past candidates

Uses sentence-transformers (all-MiniLM-L6-v2) for local, free embeddings.
No API calls required for embeddings.
"""

import logging
import hashlib
from typing import Optional, List, Dict, Any
from datetime import datetime

import chromadb
from chromadb.config import Settings

from config.settings import CHROMA_PATH

logger = logging.getLogger(__name__)

# ============================================================================
# LAZY-LOAD EMBEDDING FUNCTION
# ============================================================================

_embedding_model = None


def _get_embedding_model():
    """Lazy-load the sentence-transformers model."""
    global _embedding_model
    if _embedding_model is None:
        try:
            from sentence_transformers import SentenceTransformer
            logger.info("Loading embedding model: all-MiniLM-L6-v2")
            _embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
            logger.info("Embedding model loaded successfully")
        except ImportError:
            raise ImportError(
                "sentence-transformers is required for vector memory. "
                "Install with: pip install sentence-transformers"
            )
    return _embedding_model


# ============================================================================
# CHROMADB CLIENT — FIXED FOR NEW API
# ============================================================================

_chroma_client = None
_collection = None


def _get_client() -> chromadb.PersistentClient:
    """Lazy-load ChromaDB client (new PersistentClient API)."""
    global _chroma_client
    if _chroma_client is None:
        try:
            _chroma_client = chromadb.PersistentClient(
                path=CHROMA_PATH,
                settings=Settings(
                    anonymized_telemetry=False,
                )
            )
            logger.info(f"ChromaDB client initialized at {CHROMA_PATH}")
        except Exception as e:
            logger.error(f"Failed to initialize ChromaDB: {e}")
            raise
    return _chroma_client


def _get_collection():
    """Lazy-load or create the collection."""
    global _collection
    if _collection is None:
        client = _get_client()
        try:
            _collection = client.get_collection("venturescout_memories")
        except ValueError:
            # Collection doesn't exist, create it
            _collection = client.create_collection(
                name="venturescout_memories",
                metadata={"description": "VentureScout AI dossier memories"}
            )
            logger.info("Created new ChromaDB collection: venturescout_memories")
    return _collection


# ============================================================================
# EMBEDDING HELPERS
# ============================================================================

def _get_embedding(text: str) -> List[float]:
    """Get embedding vector for a text string."""
    model = _get_embedding_model()
    return model.encode(text).tolist()


def _generate_id(prefix: str, text: str) -> str:
    """Generate a deterministic ID for a document."""
    hash_obj = hashlib.md5(text.encode())
    return f"{prefix}_{hash_obj.hexdigest()[:16]}"


# ============================================================================
# MAIN VECTOR MEMORY OPERATIONS
# ============================================================================

def add_memory(
    candidate_id: int,
    dossier_summary: str,
    decision: str = "pending",
    weighted_score: Optional[float] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Add a dossier to vector memory for semantic search.
    
    Args:
        candidate_id: ID from seen_candidates table
        dossier_summary: Text summary of the dossier (for embedding)
        decision: 'INVEST', 'PASS', or 'pending'
        weighted_score: Final weighted score (if available)
        metadata: Additional metadata to store
    
    Returns:
        str: Document ID in ChromaDB
    """
    collection = _get_collection()
    
    # Create document ID
    doc_id = _generate_id(f"candidate_{candidate_id}", dossier_summary)
    
    # Build metadata
    meta = {
        "candidate_id": candidate_id,
        "decision": decision,
        "timestamp": datetime.utcnow().isoformat(),
    }
    if weighted_score is not None:
        meta["weighted_score"] = weighted_score
    if metadata:
        meta.update(metadata)
    
    # Get embedding
    embedding = _get_embedding(dossier_summary)
    
    # Add to collection (upsert by ID)
    try:
        collection.upsert(
            ids=[doc_id],
            embeddings=[embedding],
            metadatas=[meta],
            documents=[dossier_summary],
        )
        logger.debug(f"Added memory for candidate {candidate_id} (ID: {doc_id})")
    except Exception as e:
        logger.error(f"Failed to add memory for candidate {candidate_id}: {e}")
        raise
    
    return doc_id


def query_memory(
    query: str,
    n_results: int = 5,
    filter_by_decision: Optional[str] = None,
    min_score: Optional[float] = None,
) -> List[Dict[str, Any]]:
    """
    Query vector memory for semantically similar dossiers.
    
    Args:
        query: The search query text
        n_results: Number of results to return
        filter_by_decision: 'INVEST', 'PASS', or None (all)
        min_score: Minimum weighted_score to filter by
    
    Returns:
        List of dicts with document, metadata, and distance
    """
    collection = _get_collection()
    
    # Build where filter
    where = {}
    if filter_by_decision:
        where["decision"] = filter_by_decision
    if min_score is not None:
        where["weighted_score"] = {"$gte": min_score}
    
    # Get embedding for query
    query_embedding = _get_embedding(query)
    
    # Query collection
    try:
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results,
            where=where if where else None,
            include=["documents", "metadatas", "distances"],
        )
    except Exception as e:
        logger.error(f"Failed to query vector memory: {e}")
        return []
    
    # Format results
    formatted_results = []
    if results and results["ids"] and len(results["ids"]) > 0:
        for i, doc_id in enumerate(results["ids"][0]):
            formatted_results.append({
                "id": doc_id,
                "document": results["documents"][0][i] if results["documents"] else "",
                "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
                "distance": results["distances"][0][i] if results["distances"] else None,
            })
    
    return formatted_results


# ============================================================================
# CHAT INTERFACE SUPPORT
# ============================================================================

def retrieve_context_for_query(
    query: str,
    n_results: int = 3,
) -> str:
    """
    Retrieve relevant context from vector memory for chat.
    
    Returns:
        str: Formatted context for the LLM
    """
    results = query_memory(query, n_results=n_results)
    
    if not results:
        return "No relevant past dossiers found."
    
    context_parts = []
    for i, result in enumerate(results, 1):
        meta = result["metadata"]
        doc = result["document"]
        distance = result["distance"]
        
        # Format each result
        part = f"[{i}] {meta.get('candidate_id', 'Unknown')} | "
        part += f"Decision: {meta.get('decision', 'pending')} | "
        if "weighted_score" in meta:
            part += f"Score: {meta['weighted_score']:.1f} | "
        part += f"Similarity: {(1 - distance):.2f}\n"
        part += f"Summary: {doc[:200]}..."
        context_parts.append(part)
    
    return "\n\n".join(context_parts)


def chat_with_memory(query: str, n_results: int = 3) -> Dict[str, Any]:
    """
    Full chat response using vector memory.
    
    Returns:
        {
            "response": str,        # LLM-generated response
            "sources": list,        # Source candidates used
        }
    """
    from src.llm.client import call_llm
    
    # Retrieve relevant context
    context = retrieve_context_for_query(query, n_results=n_results)
    results = query_memory(query, n_results=n_results)
    
    # Build prompt
    prompt = f"""
You are VentureScout AI, a helpful assistant with access to past investment committee decisions.

USER QUERY: {query}

RELEVANT PAST DECISIONS:
{context}

Based on the past decisions above and your knowledge of venture investing, provide a thoughtful response to the user's query.
If the query asks about a specific type of startup, reference similar cases from the past decisions.
Be honest about what you know and don't know.
"""
    
    system_prompt = """You are VentureScout AI, an assistant that provides insights from past investment committee decisions. 
You have access to dossiers and decisions from previous candidates. 
Be helpful, concise, and reference specific examples from the context provided."""
    
    # Get LLM response
    try:
        response = call_llm(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=0.5,
            max_tokens=500,
        )
    except Exception as e:
        logger.error(f"LLM chat failed: {e}")
        return {
            "response": "I'm sorry, I'm having trouble processing your request right now.",
            "sources": []
        }
    
    # Extract sources
    sources = []
    for result in results:
        sources.append({
            "candidate_id": result["metadata"].get("candidate_id"),
            "decision": result["metadata"].get("decision"),
            "timestamp": result["metadata"].get("timestamp"),
        })
    
    return {
        "response": response,
        "sources": sources,
    }


# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def get_collection_stats() -> Dict[str, Any]:
    """Get statistics about the vector collection."""
    collection = _get_collection()
    count = collection.count()
    return {
        "collection_name": collection.name,
        "document_count": count,
        "path": CHROMA_PATH,
    }


def clear_vector_memory():
    """Clear all vector memory (for testing/reset)."""
    collection = _get_collection()
    all_ids = collection.get()["ids"]
    if all_ids:
        collection.delete(ids=all_ids)
        logger.info(f"Cleared {len(all_ids)} vector memories")
    else:
        logger.info("Vector memory already empty")


def delete_memory(candidate_id: int):
    """Delete all vector memories for a specific candidate."""
    collection = _get_collection()
    results = collection.get(
        where={"candidate_id": candidate_id}
    )
    if results["ids"]:
        collection.delete(ids=results["ids"])
        logger.info(f"Deleted vector memory for candidate {candidate_id}")


def update_memory_decision(candidate_id: int, decision: str, score: float):
    """
    Update the decision and score for a candidate in vector memory.
    """
    collection = _get_collection()
    results = collection.get(
        where={"candidate_id": candidate_id}
    )
    
    if not results["ids"]:
        logger.warning(f"No vector memory found for candidate {candidate_id}")
        return
    
    for i, doc_id in enumerate(results["ids"]):
        meta = results["metadatas"][i]
        meta["decision"] = decision
        meta["weighted_score"] = score
        
        collection.update(
            ids=[doc_id],
            metadatas=[meta],
        )
    
    logger.info(f"Updated memory for candidate {candidate_id}: {decision} ({score:.1f})")


# ============================================================================
# INITIALIZATION
# ============================================================================

def init_vector_memory():
    """Initialize vector memory. Creates collection if it doesn't exist."""
    try:
        _get_collection()
        stats = get_collection_stats()
        logger.info(f"Vector memory initialized: {stats['document_count']} documents")
    except Exception as e:
        logger.warning(f"Vector memory initialization warning: {e}")
        # Continue without vector memory


if __name__ == "__main__":
    # Quick test
    logging.basicConfig(level=logging.INFO)
    
    # Initialize
    init_vector_memory()
    print(f"✅ Vector memory initialized at {CHROMA_PATH}")
    
    # Test adding a memory
    test_summary = "Test startup using AI for legal document review. Founded by 2 ex-lawyers. Pre-seed stage."
    doc_id = add_memory(
        candidate_id=1,
        dossier_summary=test_summary,
        decision="pending",
    )
    print(f"✅ Added test memory: {doc_id}")
    
    # Test query
    results = query_memory("AI legal tech startup")
    print(f"✅ Query returned {len(results)} results")
    
    # Show stats
    stats = get_collection_stats()
    print(f"✅ Collection stats: {stats}")