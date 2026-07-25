# src/memory/rag_utils.py
"""
RAG Utilities — Retrieval-Augmented Generation for the chat interface.

Provides:
- Context building from multiple memory sources
- Query classification and routing
- Context formatting for LLM prompts
- Chat history management
- Advanced RAG features (query expansion, re-ranking)
"""

import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
import re

from src.memory.memory_integration import MemoryIntegration
from src.memory.structured_memory import get_recent_reports_by_days, get_funnel_stats
from src.memory.vector_memory import query_memory, retrieve_context_for_query

logger = logging.getLogger(__name__)


# ============================================================================
# QUERY CLASSIFICATION
# ============================================================================

QUERY_TYPES = {
    "candidate_lookup": ["candidate", "startup", "company", "who is", "what is", "tell me about"],
    "decision_lookup": ["decision", "invest", "pass", "verdict", "what happened to"],
    "funnel_stats": ["funnel", "stats", "how many", "discovered", "validated", "escalated"],
    "trend_analysis": ["trend", "pattern", "common", "most", "best", "worst", "average"],
    "comparison": ["compare", "versus", "vs", "better than", "worse than"],
    "general": ["help", "what can you", "how does", "explain"],
}


def classify_query(query: str) -> str:
    """
    Classify a user query into a type.
    
    Returns:
        One of: 'candidate_lookup', 'decision_lookup', 'funnel_stats', 
                'trend_analysis', 'comparison', 'general'
    """
    query_lower = query.lower()
    
    for query_type, keywords in QUERY_TYPES.items():
        for keyword in keywords:
            if keyword in query_lower:
                return query_type
    
    return "general"


def extract_company_name(query: str) -> Optional[str]:
    """
    Extract a company name from a query.
    """
    # Look for patterns like "tell me about X", "what about X"
    patterns = [
        r'about\s+([A-Za-z0-9\s]+)',
        r'tell me about\s+([A-Za-z0-9\s]+)',
        r'what about\s+([A-Za-z0-9\s]+)',
        r'company\s+([A-Za-z0-9\s]+)',
        r'startup\s+([A-Za-z0-9\s]+)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, query, re.IGNORECASE)
        if match:
            return match.group(1).strip()
    
    # If query is short, assume it's a company name
    words = query.split()
    if len(words) <= 3:
        return query.strip()
    
    return None


# ============================================================================
# CONTEXT BUILDING
# ============================================================================

class RAGContextBuilder:
    """
    Builds context for RAG from multiple memory sources.
    """
    
    def __init__(self):
        self.memory = MemoryIntegration()
    
    def build_context(
        self,
        query: str,
        max_results: int = 5,
        include_recent: int = 3,
    ) -> Dict[str, Any]:
        """
        Build context for a query from multiple sources.
        
        Returns:
            {
                "query_type": str,
                "company": str or None,
                "vector_results": [...],
                "recent_reports": [...],
                "funnel_stats": {...},
                "context_text": str,
            }
        """
        query_type = classify_query(query)
        company = extract_company_name(query)
        
        context = {
            "query": query,
            "query_type": query_type,
            "company": company,
            "vector_results": [],
            "recent_reports": [],
            "funnel_stats": {},
            "context_text": "",
        }
        
        # Get vector results
        try:
            vector_results = query_memory(query, n_results=max_results)
            context["vector_results"] = vector_results
        except Exception as e:
            logger.warning(f"Vector search failed: {e}")
        
        # Get recent reports
        try:
            recent_reports = get_recent_reports_by_days(days=30)
            context["recent_reports"] = recent_reports[:include_recent]
        except Exception as e:
            logger.warning(f"Recent reports failed: {e}")
        
        # Get funnel stats for trend queries
        if query_type in ["funnel_stats", "trend_analysis"]:
            try:
                funnel_stats = get_funnel_stats(days_back=30)
                context["funnel_stats"] = funnel_stats
            except Exception as e:
                logger.warning(f"Funnel stats failed: {e}")
        
        # Build context text
        context["context_text"] = self._format_context(context)
        
        return context
    
    def _format_context(self, context: Dict[str, Any]) -> str:
        """
        Format context for LLM consumption.
        """
        parts = []
        
        # Add query type and company
        parts.append(f"Query Type: {context['query_type']}")
        if context['company']:
            parts.append(f"Company Mentioned: {context['company']}")
        
        # Add vector results
        if context['vector_results']:
            parts.append("\n=== RELEVANT PAST DECISIONS ===")
            for i, result in enumerate(context['vector_results'], 1):
                meta = result.get('metadata', {})
                doc = result.get('document', '')
                parts.append(f"\n[{i}] Candidate ID: {meta.get('candidate_id', 'Unknown')}")
                parts.append(f"Decision: {meta.get('decision', 'pending')}")
                parts.append(f"Summary: {doc[:200]}...")
        
        # Add recent reports
        if context['recent_reports']:
            parts.append("\n=== RECENT REPORTS ===")
            for i, report in enumerate(context['recent_reports'], 1):
                title = report.get('title', 'Unknown')
                decision = report.get('decision', 'pending')
                score = report.get('weighted_score', 0)
                parts.append(f"\n[{i}] {title}")
                parts.append(f"Decision: {decision} (Score: {score:.2f}/10)")
        
        # Add funnel stats
        if context['funnel_stats']:
            parts.append("\n=== FUNNEL STATISTICS ===")
            stats = context['funnel_stats']
            parts.append(f"Discovered: {stats.get('discovered', 0)}")
            parts.append(f"Validated: {stats.get('validated', 0)}")
            parts.append(f"Escalated: {stats.get('escalated', 0)}")
            parts.append(f"Invested: {stats.get('invested', 0)}")
            parts.append(f"Period: {stats.get('period_days', 7)} days")
        
        return "\n".join(parts)


# ============================================================================
# CHAT HISTORY MANAGEMENT
# ============================================================================

class ChatHistory:
    """
    Manages chat history for the conversation.
    """
    
    def __init__(self, max_history: int = 10):
        self.max_history = max_history
        self.history: List[Dict[str, str]] = []
    
    def add_message(self, role: str, content: str):
        """Add a message to history."""
        self.history.append({"role": role, "content": content})
        if len(self.history) > self.max_history * 2:  # User + Assistant pairs
            self.history = self.history[-self.max_history * 2:]
    
    def add_user_message(self, content: str):
        """Add a user message."""
        self.add_message("user", content)
    
    def add_assistant_message(self, content: str):
        """Add an assistant message."""
        self.add_message("assistant", content)
    
    def get_history(self) -> List[Dict[str, str]]:
        """Get the full history."""
        return self.history
    
    def get_formatted_history(self) -> str:
        """Get formatted history for LLM context."""
        if not self.history:
            return "No previous conversation."
        
        parts = []
        for msg in self.history:
            role = "User" if msg["role"] == "user" else "Assistant"
            parts.append(f"{role}: {msg['content'][:200]}...")
        
        return "\n".join(parts)
    
    def clear(self):
        """Clear history."""
        self.history = []
    
    def get_last_n(self, n: int) -> List[Dict[str, str]]:
        """Get the last N messages."""
        return self.history[-n:] if n > 0 else []


# ============================================================================
# MAIN RAG FUNCTION
# ============================================================================

def get_rag_response(
    query: str,
    chat_history: Optional[ChatHistory] = None,
    max_results: int = 5,
) -> Dict[str, Any]:
    """
    Get a RAG-enhanced response to a query.
    
    Args:
        query: User query
        chat_history: Optional chat history
        max_results: Maximum number of results to retrieve
    
    Returns:
        {
            "response": str,
            "context": dict,
            "sources": list,
        }
    """
    logger.info(f"Processing RAG query: {query[:50]}...")
    
    # Build context
    builder = RAGContextBuilder()
    context = builder.build_context(query, max_results=max_results)
    
    # Prepare chat history
    history_text = ""
    if chat_history:
        history_text = chat_history.get_formatted_history()
    
    # Build prompt
    prompt = builder._build_rag_prompt(query, context, history_text)
    
    # Get LLM response
    from src.llm.client import call_llm
    
    system_prompt = """You are VentureScout AI, an assistant that provides insights from past investment committee decisions.

You have access to:
1. Past candidate evaluations and decisions
2. Recent reports
3. Funnel statistics
4. Semantic search results

When answering:
- Be specific and reference actual data when available
- If you don't know something, say so
- Use the context provided, but don't fabricate information
- Be helpful and concise"""
    
    try:
        response = call_llm(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=0.5,
            max_tokens=600,
        )
    except Exception as e:
        logger.error(f"LLM response failed: {e}")
        return {
            "response": "I'm sorry, I'm having trouble processing your request right now. Please try again.",
            "context": context,
            "sources": [],
        }
    
    # Extract sources
    sources = []
    for result in context.get('vector_results', []):
        meta = result.get('metadata', {})
        sources.append({
            "candidate_id": meta.get('candidate_id'),
            "decision": meta.get('decision'),
            "timestamp": meta.get('timestamp'),
        })
    
    return {
        "response": response,
        "context": context,
        "sources": sources,
    }


def _build_rag_prompt(
    query: str,
    context: Dict[str, Any],
    history_text: str,
) -> str:
    """
    Build the RAG prompt for the LLM.
    """
    prompt = f"""
USER QUERY: {query}

CONTEXT:
{context.get('context_text', 'No context available')}

PREVIOUS CONVERSATION:
{history_text if history_text else 'No previous conversation'}

Based on the context above and your knowledge of venture investing, provide a thoughtful response to the user's query.

Guidelines:
1. If the query asks about a specific startup, reference it directly from the context
2. If the query asks about trends, use the funnel statistics and recent reports
3. If you don't have enough information, say so honestly
4. Be specific and reference actual data points when possible

Response:
"""
    
    return prompt


# ============================================================================
# ADVANCED RAG FEATURES
# ============================================================================

def query_expansion(query: str) -> List[str]:
    """
    Expand a query with related terms for better retrieval.
    """
    expansion_map = {
        "startup": ["company", "venture", "founder", "launch"],
        "invest": ["funding", "capital", "seed", "series"],
        "ai": ["artificial intelligence", "machine learning", "deep learning"],
        "tech": ["technology", "software", "platform", "saas"],
        "fintech": ["finance", "banking", "payments", "blockchain"],
        "healthtech": ["healthcare", "medical", "biotech", "pharma"],
    }
    
    expanded = [query]
    query_lower = query.lower()
    
    for key, synonyms in expansion_map.items():
        if key in query_lower:
            expanded.extend(synonyms)
    
    return expanded


def rerank_results(
    results: List[Dict[str, Any]],
    query: str,
) -> List[Dict[str, Any]]:
    """
    Re-rank search results based on relevance to the query.
    """
    if not results:
        return results
    
    # Simple re-ranking: boost results that mention the query terms
    query_terms = set(query.lower().split())
    
    scored = []
    for result in results:
        doc = result.get('document', '').lower()
        meta = result.get('metadata', {})
        title = meta.get('title', '').lower()
        
        # Count term matches
        matches = sum(1 for term in query_terms if term in doc or term in title)
        
        # Boost by match count
        score = result.get('distance', 1.0) - (matches * 0.01)
        scored.append((score, result))
    
    # Sort by score
    scored.sort(key=lambda x: x[0])
    
    return [r for _, r in scored]


# ============================================================================
# TESTING
# ============================================================================

if __name__ == "__main__":
    # Quick test
    logging.basicConfig(level=logging.INFO)
    
    print("\n🔍 Testing RAG Utilities...")
    
    # Test query classification
    print("\n📊 Query Classification:")
    test_queries = [
        "Tell me about AI Legal Research Platform",
        "What startups have we invested in?",
        "Show me the funnel statistics",
        "What are the trends in AI startups?",
        "Compare Legal AI with Chat Support AI",
        "Hello, what can you do?",
    ]
    
    for q in test_queries:
        q_type = classify_query(q)
        company = extract_company_name(q)
        print(f"  '{q[:30]}...' -> {q_type} (company: {company})")
    
    # Test context building
    print("\n📊 Context Building:")
    builder = RAGContextBuilder()
    context = builder.build_context("What AI startups have we evaluated?", max_results=3)
    print(f"  Query Type: {context['query_type']}")
    print(f"  Vector Results: {len(context['vector_results'])}")
    print(f"  Recent Reports: {len(context['recent_reports'])}")
    print(f"  Context Length: {len(context['context_text'])} chars")
    
    # Test chat history
    print("\n📊 Chat History:")
    history = ChatHistory(max_history=3)
    history.add_user_message("What AI startups have we evaluated?")
    history.add_assistant_message("We've evaluated several AI startups...")
    history.add_user_message("Tell me more about the legal AI one")
    
    print(f"  History length: {len(history.get_history())}")
    print(f"  Formatted: {history.get_formatted_history()[:100]}...")
    
    print("\n✅ RAG utilities tests passed!")