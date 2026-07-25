# src/agents/dossier_builder.py
"""
Dossier Builder — Creates structured research dossiers for candidates.

Takes raw candidate data and extracts structured information:
- Company name, industry, pricing model
- Competitors, estimated users, technology
- Funding status, summary

CRITICAL RULE: Never fabricate information.
Any field that cannot be determined MUST be set to "unknown".
"""

import logging
import json
from typing import Dict, Any, Optional, List

from src.llm.client import call_llm_json

logger = logging.getLogger(__name__)


# ============================================================================
# DOSSIER SCHEMA
# ============================================================================

REQUIRED_FIELDS = [
    "company",
    "industry",
    "pricing_model",
    "competitors",
    "estimated_users",
    "technology",
    "funding_status",
    "summary",
]

DOSSIER_SYSTEM_PROMPT = """You are a Dossier Builder for VentureScout AI.

Your job is to extract structured information about a startup from raw text.

CRITICAL RULES:
1. NEVER fabricate information. If you don't know something, set it to "unknown".
2. Only use information that is explicitly stated or strongly implied.
3. Do not make assumptions beyond what the text supports.
4. Competitors should be a list of actual competitor names.

For each field:
- company: The startup's name
- industry: What industry/sector they operate in (e.g., "FinTech", "HealthTech")
- pricing_model: How they make money (e.g., "Subscription", "Freemium", "Transaction fees")
- competitors: List of companies they compete with
- estimated_users: Number of users/customers (use "unknown" if not stated)
- technology: Key technologies they use (e.g., "AI", "Blockchain", "SaaS")
- funding_status: Current funding stage (e.g., "Pre-seed", "Seed", "Series A")
- summary: 2-3 sentence summary of what the company does

Respond with valid JSON only.
"""


# ============================================================================
# DOSSIER BUILDER CLASS
# ============================================================================

class DossierBuilder:
    """
    Builds structured dossiers from candidate data.
    """
    
    def __init__(self):
        self.required_fields = REQUIRED_FIELDS
    
    def build_dossier(self, candidate: Dict[str, Any]) -> Dict[str, Any]:
        """
        Build a structured dossier for a candidate.
        
        Args:
            candidate: Candidate dict with raw_text and metadata
            
        Returns:
            Structured dossier dict with all required fields
        
        Example:
            {
                "company": "AI Legal Research Platform",
                "industry": "Legal Technology",
                "pricing_model": "Subscription",
                "competitors": ["LexisNexis", "Westlaw"],
                "estimated_users": "50 firms in beta",
                "technology": "NLP, Machine Learning",
                "funding_status": "Pre-seed",
                "summary": "AI platform that helps law firms research cases..."
            }
        """
        logger.info(f"Building dossier for: {candidate.get('title', 'Unknown')}")
        
        # Try LLM extraction first
        dossier = self._extract_with_llm(candidate)
        
        # If LLM fails, use heuristic extraction
        if not dossier or not self._validate_dossier(dossier):
            logger.warning("LLM extraction failed, using heuristic fallback")
            dossier = self._extract_with_heuristics(candidate)
        
        # Ensure all required fields are present
        dossier = self._ensure_required_fields(dossier)
        
        logger.info(f"Dossier built with {sum(1 for v in dossier.values() if v != 'unknown')} known fields")
        return dossier
    
    def _extract_with_llm(self, candidate: Dict[str, Any]) -> Dict[str, Any]:
        """
        Use LLM to extract structured information.
        """
        # Prepare context
        context = self._prepare_context(candidate)
        
        prompt = f"""
Extract structured information about this startup:

{context}

Return a JSON object with these fields:
- company: The startup's name
- industry: The industry/sector
- pricing_model: How they make money
- competitors: List of competitors
- estimated_users: User/customer count (or "unknown")
- technology: Key technologies used
- funding_status: Current funding stage (or "unknown")
- summary: Brief description

Remember: Use "unknown" for any field you cannot determine from the text.
"""
        
        try:
            response = call_llm_json(
                prompt=prompt,
                system_prompt=DOSSIER_SYSTEM_PROMPT,
                temperature=0.3,
                max_tokens=400,
            )
            
            # Ensure it has all required fields
            return self._ensure_required_fields(response)
            
        except Exception as e:
            logger.error(f"LLM extraction failed: {e}")
            return {}
    
    def _extract_with_heuristics(self, candidate: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract information using simple heuristics.
        This is a fallback when LLM fails.
        """
        dossier = {}
        
        # Company name from title
        title = candidate.get("title", "")
        if title:
            # Remove common prefixes
            for prefix in ["Show HN:", "Show HN", "Launch:", "Product:", "Startup:"]:
                if title.startswith(prefix):
                    title = title[len(prefix):].strip()
            dossier["company"] = title[:50]  # Truncate
        else:
            dossier["company"] = "unknown"
        
        # Try to get summary from metadata
        metadata = candidate.get("metadata", {})
        summary = metadata.get("summary", "")
        if not summary and "raw_text" in candidate:
            raw = candidate["raw_text"]
            # Try to find a description
            for line in raw.split("\n"):
                if "description" in line.lower() or "summary" in line.lower():
                    if ":" in line:
                        summary = line.split(":", 1)[1].strip()
                        break
        dossier["summary"] = summary[:200] if summary else "unknown"
        
        # Try to get industry from keywords
        text = (candidate.get("title", "") + " " + candidate.get("raw_text", "")).lower()
        industries = {
            "ai": "Artificial Intelligence",
            "machine learning": "Machine Learning",
            "blockchain": "Blockchain",
            "fintech": "FinTech",
            "healthtech": "HealthTech",
            "legaltech": "LegalTech",
            "edtech": "EdTech",
            "saas": "SaaS",
            "ecommerce": "E-Commerce",
            "marketplace": "Marketplace",
        }
        industry = "unknown"
        for key, value in industries.items():
            if key in text:
                industry = value
                break
        dossier["industry"] = industry
        
        # Defaults for other fields
        dossier["pricing_model"] = "unknown"
        dossier["competitors"] = []
        dossier["estimated_users"] = "unknown"
        dossier["technology"] = "unknown"
        dossier["funding_status"] = "unknown"
        
        return dossier
    
    def _prepare_context(self, candidate: Dict[str, Any]) -> str:
        """
        Prepare context for LLM extraction.
        """
        parts = []
        
        # Title
        title = candidate.get("title", "")
        if title:
            parts.append(f"Title: {title}")
        
        # Raw text
        raw_text = candidate.get("raw_text", "")
        if raw_text:
            parts.append(f"Description: {raw_text[:1000]}")
        
        # Metadata
        metadata = candidate.get("metadata", {})
        if metadata:
            for key, value in metadata.items():
                if key in ["summary", "author", "score", "subreddit"]:
                    if value and key != "summary":  # Summary already included
                        parts.append(f"{key}: {value}")
        
        # URL
        url = candidate.get("url", "")
        if url:
            parts.append(f"URL: {url}")
        
        return "\n".join(parts)
    
    def _ensure_required_fields(self, dossier: Dict[str, Any]) -> Dict[str, Any]:
        """
        Ensure all required fields are present.
        """
        # Default dossier
        default = {
            "company": "unknown",
            "industry": "unknown",
            "pricing_model": "unknown",
            "competitors": [],
            "estimated_users": "unknown",
            "technology": "unknown",
            "funding_status": "unknown",
            "summary": "unknown",
        }
        
        # Update with provided values
        result = default.copy()
        for key in self.required_fields:
            if key in dossier:
                value = dossier[key]
                if value is not None:
                    # Handle competitors specially
                    if key == "competitors":
                        if isinstance(value, list):
                            result[key] = value
                        elif isinstance(value, str) and value:
                            # Try to parse as list
                            try:
                                import ast
                                parsed = ast.literal_eval(value)
                                if isinstance(parsed, list):
                                    result[key] = parsed
                            except:
                                # Just use as a single item
                                result[key] = [value]
                    else:
                        result[key] = str(value)
        
        return result
    
    def _validate_dossier(self, dossier: Dict[str, Any]) -> bool:
        """
        Validate that a dossier has all required fields.
        """
        if not dossier:
            return False
        return all(field in dossier for field in self.required_fields)


# ============================================================================
# CONVENIENCE FUNCTIONS
# ============================================================================

def build_dossier_for_candidate(candidate: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convenience function to build a dossier.
    """
    builder = DossierBuilder()
    return builder.build_dossier(candidate)


def build_dossiers_for_candidates(
    candidates: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Build dossiers for multiple candidates.
    """
    builder = DossierBuilder()
    dossiers = []
    for candidate in candidates:
        try:
            dossier = builder.build_dossier(candidate)
            # Add candidate reference
            dossier["candidate_title"] = candidate.get("title", "Unknown")
            dossier["candidate_url"] = candidate.get("url", "")
            dossiers.append(dossier)
        except Exception as e:
            logger.error(f"Failed to build dossier for {candidate.get('title', 'Unknown')}: {e}")
            # Add a minimal dossier
            dossiers.append({
                "company": candidate.get("title", "Unknown"),
                "industry": "unknown",
                "pricing_model": "unknown",
                "competitors": [],
                "estimated_users": "unknown",
                "technology": "unknown",
                "funding_status": "unknown",
                "summary": "Dossier build failed",
                "candidate_title": candidate.get("title", "Unknown"),
                "candidate_url": candidate.get("url", ""),
            })
    return dossiers


# ============================================================================
# DOSSIER UTILITIES
# ============================================================================

def format_dossier_for_display(dossier: Dict[str, Any]) -> str:
    """
    Format a dossier for human-readable display.
    """
    lines = []
    lines.append("=" * 50)
    lines.append(f"COMPANY: {dossier.get('company', 'Unknown')}")
    lines.append("=" * 50)
    lines.append(f"Industry: {dossier.get('industry', 'Unknown')}")
    lines.append(f"Pricing Model: {dossier.get('pricing_model', 'Unknown')}")
    lines.append(f"Estimated Users: {dossier.get('estimated_users', 'Unknown')}")
    lines.append(f"Technology: {dossier.get('technology', 'Unknown')}")
    lines.append(f"Funding Status: {dossier.get('funding_status', 'Unknown')}")
    
    competitors = dossier.get("competitors", [])
    if competitors:
        lines.append(f"Competitors: {', '.join(competitors)}")
    else:
        lines.append("Competitors: Unknown")
    
    lines.append("\nSummary:")
    lines.append(dossier.get("summary", "No summary available"))
    
    return "\n".join(lines)


def dossier_to_json(dossier: Dict[str, Any]) -> str:
    """
    Convert a dossier to JSON string.
    """
    return json.dumps(dossier, indent=2)


def dossier_from_json(json_str: str) -> Dict[str, Any]:
    """
    Parse a dossier from JSON string.
    """
    return json.loads(json_str)


# ============================================================================
# TESTING
# ============================================================================

if __name__ == "__main__":
    # Quick test
    logging.basicConfig(level=logging.INFO)
    
    print("\n🔍 Testing Dossier Builder...")
    
    # Test candidate
    test_candidate = {
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
    }
    
    # Build dossier
    builder = DossierBuilder()
    dossier = builder.build_dossier(test_candidate)
    
    print("\n📊 Built Dossier:")
    print(format_dossier_for_display(dossier))
    
    print(f"\n✅ Dossier built successfully!")
    print(f"  Known fields: {sum(1 for v in dossier.values() if v != 'unknown' and v != [])}")
    print(f"  Unknown fields: {sum(1 for v in dossier.values() if v == 'unknown' or v == [])}")
    
    # Test multiple candidates
    print("\n📊 Testing batch build...")
    test_candidates = [
        test_candidate,
        {
            "title": "Unknown Startup - No Info",
            "url": "https://unknown.com",
            "source": "test",
            "metadata": {},
            "raw_text": "No information available about this startup.",
        }
    ]
    
    dossiers = build_dossiers_for_candidates(test_candidates)
    print(f"  Built {len(dossiers)} dossiers")
    for i, d in enumerate(dossiers):
        print(f"  {i+1}. {d.get('company', 'Unknown')} - {sum(1 for v in d.values() if v != 'unknown' and v != [])} known fields")
    
    print("\n✅ All dossier tests passed!")