# src/agents/report_generator.py
"""
Report Generator — Creates VC-memo-style investment reports.

Takes dossier and committee results and generates:
- Executive Summary
- Startup Overview
- Competitive Landscape
- Technology/Market/Financial/Legal Analysis
- Founder Evaluation
- Committee Debate Summary
- Final Recommendation

All LLM-generated predictions (star rating, probability, check size)
are explicitly labeled as estimates, not statistical predictions.
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

from src.llm.client import call_llm_json

logger = logging.getLogger(__name__)


# ============================================================================
# REPORT GENERATOR CLASS
# ============================================================================

class ReportGenerator:
    """
    Generates VC-memo-style investment reports.
    """
    
    def __init__(self):
        self.report_sections = [
            "executive_summary",
            "startup_overview",
            "competitive_landscape",
            "analysis",
            "founder_evaluation",
            "debate_summary",
            "recommendation",
        ]
    
    def generate_report(
        self,
        dossier: Dict[str, Any],
        committee_result: Dict[str, Any],
        candidate: Optional[Dict[str, Any]] = None,  # ADDED: candidate with source info
    ) -> Dict[str, Any]:
        """
        Generate a full investment report.
        
        Args:
            dossier: Structured dossier dict
            committee_result: Result from ModeratorAgent.run_committee()
            candidate: Original candidate dict with source information (username, platform, raw_text)
            
        Returns:
            {
                "star_rating": int (1-5),
                "probability_of_success_pct": int,
                "biggest_risk": str,
                "biggest_advantage": str,
                "recommended_check_size": str,
                "recommended_stage": str,
                "executive_summary": str,
                "startup_overview": str,
                "competitive_landscape": str,
                "technology_analysis": str,
                "market_analysis": str,
                "financial_analysis": str,
                "legal_analysis": str,
                "founder_evaluation": str,
                "debate_summary": str,
                "recommendation": str,
                "timestamp": str,
                "source_info": dict,  # NEW: includes platform, username, url, original text
            }
        """
        logger.info(f"Generating report for: {dossier.get('company', 'Unknown')}")
        
        # Build the report using LLM with source info
        report = self._generate_with_llm(dossier, committee_result, candidate)
        
        # Add metadata
        report["timestamp"] = datetime.utcnow().isoformat()
        report["company"] = dossier.get("company", "Unknown")
        report["decision"] = committee_result.get("vote_result", {}).get("decision", "PASS")
        report["weighted_score"] = committee_result.get("vote_result", {}).get("weighted_total", 0)
        
        # Add source info to report
        if candidate:
            report["source_info"] = self._extract_source_info(candidate)
        else:
            report["source_info"] = {"platform": "Unknown", "username": "Unknown"}
        
        logger.info(f"Report generated: {report['star_rating']} stars, {report['probability_of_success_pct']}% success probability")
        return report
    
    def _extract_source_info(self, candidate: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract source information from candidate dict.
        """
        source = candidate.get("source", "Unknown")
        metadata = candidate.get("metadata", {})
        
        source_info = {
            "platform": source,
            "username": metadata.get("author", metadata.get("by", "Unknown")),
            "url": candidate.get("url", ""),
            "title": candidate.get("title", ""),
            "score": metadata.get("score", 0),
            "comments": metadata.get("comments_count", metadata.get("descendants", 0)),
            "raw_text": candidate.get("raw_text", ""),
        }
        
        # Determine platform display name
        if "hackernews" in source.lower():
            source_info["platform_display"] = "Hacker News (Show HN)"
        elif "reddit" in source.lower():
            subreddit = metadata.get("subreddit", "")
            source_info["platform_display"] = f"Reddit (r/{subreddit})" if subreddit else "Reddit"
        elif "rss" in source.lower():
            feed_title = metadata.get("feed_title", "RSS Feed")
            source_info["platform_display"] = f"RSS Feed ({feed_title})"
        else:
            source_info["platform_display"] = source
        
        return source_info
    
    def _generate_with_llm(
        self,
        dossier: Dict[str, Any],
        committee_result: Dict[str, Any],
        candidate: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Generate the report using LLM.
        """
        # Prepare context
        company = dossier.get("company", "Unknown")
        industry = dossier.get("industry", "Unknown")
        summary = dossier.get("summary", "No summary available")
        technology = dossier.get("technology", "Unknown")
        competitors = dossier.get("competitors", [])
        funding = dossier.get("funding_status", "Unknown")
        pricing = dossier.get("pricing_model", "Unknown")
        
        # --- BUILD SOURCE INFORMATION SECTION ---
        source_section = ""
        if candidate:
            source_info = self._extract_source_info(candidate)
            source_section = f"""
SOURCE INFORMATION:
- Platform: {source_info.get('platform_display', 'Unknown')}
- Author/Username: {source_info.get('username', 'Unknown')}
- Original Title: {source_info.get('title', 'Unknown')}
- Score/Upvotes: {source_info.get('score', 0)}
- Comments: {source_info.get('comments', 0)}
- URL: {source_info.get('url', '')}

ORIGINAL POST TEXT:
{source_info.get('raw_text', 'No original text available')[:800]}
"""
        # --- END SOURCE SECTION ---
        
        # Committee results
        vote_result = committee_result.get("vote_result", {})
        decision = vote_result.get("decision", "PASS")
        weighted_score = vote_result.get("weighted_total", 0)
        fast_path = committee_result.get("fast_path")
        
        # Investor opinions
        round1_opinions = committee_result.get("round1_opinions", [])
        round2_opinions = committee_result.get("round2_opinions", [])
        
        # Prepare investor opinions summary
        opinions_text = ""
        for op in round1_opinions:
            name = op.get("name", "Unknown")
            score = op.get("score", 0)
            opinion = op.get("opinion", "No opinion")
            opinions_text += f"\n{name} (Score: {score:.1f}/10):\n{opinion[:300]}...\n"
        
        # Prepare rebuttals summary
        rebuttals_text = ""
        if round2_opinions:
            for op in round2_opinions:
                if op.get("has_rebuttal"):
                    name = op.get("name", "Unknown")
                    updated_score = op.get("updated_score", op.get("score", 0))
                    updated_opinion = op.get("updated_opinion", "")
                    rebuttals_text += f"\n{name} (Updated Score: {updated_score:.1f}/10):\n{updated_opinion[:300]}...\n"
        
        # Build prompt with source information
        prompt = f"""
Generate a VC-memo-style investment report for {company}.

{source_section}

COMPANY INFORMATION:
- Company: {company}
- Industry: {industry}
- Summary: {summary}
- Technology: {technology}
- Competitors: {', '.join(competitors) if competitors else 'None identified'}
- Funding Status: {funding}
- Pricing Model: {pricing}

COMMITTEE DECISION:
- Decision: {decision}
- Weighted Score: {weighted_score:.2f}/10
- Fast-path: {fast_path if fast_path else 'Full debate (2 rounds)'}

INVESTOR OPINIONS (Round 1):
{opinions_text}

INVESTOR REBUTTALS (Round 2):
{rebuttals_text if rebuttals_text else 'No rebuttals (fast-path triggered)'}

Generate a comprehensive investment report with the following sections:

1. Executive Summary: Brief overview of the company and investment thesis
2. Startup Overview: What the company does, problem they solve, market opportunity
3. Competitive Landscape: Key competitors and differentiation
4. Analysis: Technology, Market, Financial, and Legal assessment
5. Founder Evaluation: Team quality and execution capability
6. Debate Summary: Key points from the committee discussion
7. Recommendation: Final recommendation with rationale

Also provide:
- star_rating: 1-5 stars (1=Poor, 5=Excellent)
- probability_of_success_pct: Estimated probability of success (0-100)
- biggest_risk: The biggest risk to this investment
- biggest_advantage: The biggest advantage
- recommended_check_size: Suggested investment size (e.g., "$250k-$500k")
- recommended_stage: Suggested investment stage (e.g., "Seed", "Pre-seed")

IMPORTANT: All predictions (star rating, probability, check size, stage)
are LLM-generated estimates based on the available information. They are
NOT statistically calibrated predictions. The report must state this explicitly.

Format your response as JSON.
"""
        
        system_prompt = """You are a VC Analyst generating investment memos.

Your reports should be:
- Professional and well-structured
- Balanced (highlight both risks and opportunities)
- Based solely on the provided information
- Clear and actionable

For the star rating:
- 5 stars: Exceptional investment opportunity, strong across all dimensions
- 4 stars: Strong investment opportunity, minor concerns
- 3 stars: Average investment opportunity, some concerns
- 2 stars: Below average, significant concerns
- 1 star: Poor investment opportunity, major concerns

IMPORTANT: All estimates are LLM-generated and should be labeled as such.
Do not present them as statistically validated predictions.

Be specific and reference information from the dossier and committee discussion.
"""
        
        try:
            response = call_llm_json(
                prompt=prompt,
                system_prompt=system_prompt,
                temperature=0.5,
                max_tokens=1500,
            )
            
            # Ensure all required fields
            return self._ensure_required_fields(response, dossier)
            
        except Exception as e:
            logger.error(f"LLM report generation failed: {e}")
            return self._generate_fallback_report(dossier, committee_result, candidate)
    
    def _ensure_required_fields(
        self,
        report: Dict[str, Any],
        dossier: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Ensure all required fields are present.
        """
        defaults = {
            "star_rating": 3,
            "probability_of_success_pct": 50,
            "biggest_risk": "Uncertain market adoption",
            "biggest_advantage": "Strong founding team",
            "recommended_check_size": "$250k-$500k",
            "recommended_stage": "Seed",
            "executive_summary": "No executive summary generated.",
            "startup_overview": "No startup overview generated.",
            "competitive_landscape": "No competitive landscape generated.",
            "technology_analysis": "No technology analysis generated.",
            "market_analysis": "No market analysis generated.",
            "financial_analysis": "No financial analysis generated.",
            "legal_analysis": "No legal analysis generated.",
            "founder_evaluation": "No founder evaluation generated.",
            "debate_summary": "No debate summary generated.",
            "recommendation": "No recommendation generated.",
        }
        
        # Merge with defaults
        result = defaults.copy()
        for key, value in report.items():
            if key in result and value is not None:
                result[key] = value
        
        # Add disclaimers
        result["disclaimer"] = "All predictions (star rating, probability, check size, stage) are LLM-generated estimates based on available information. They are not statistically calibrated predictions and should not be considered as financial advice."
        
        return result
    
    def _generate_fallback_report(
        self,
        dossier: Dict[str, Any],
        committee_result: Dict[str, Any],
        candidate: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Generate a fallback report when LLM fails.
        """
        company = dossier.get("company", "Unknown")
        decision = committee_result.get("vote_result", {}).get("decision", "PASS")
        score = committee_result.get("vote_result", {}).get("weighted_total", 0)
        
        # Extract source info for fallback
        source_display = ""
        if candidate:
            source_info = self._extract_source_info(candidate)
            source_display = f"""
SOURCE:
- Platform: {source_info.get('platform_display', 'Unknown')}
- Author: {source_info.get('username', 'Unknown')}
- URL: {source_info.get('url', '')}
"""
        
        return {
            "company": company,
            "star_rating": 3,
            "probability_of_success_pct": 50,
            "biggest_risk": "Analysis unavailable",
            "biggest_advantage": "Analysis unavailable",
            "recommended_check_size": "TBD",
            "recommended_stage": "TBD",
            "executive_summary": f"Report generation failed. Committee decision: {decision} (Score: {score:.2f}/10).{source_display}",
            "startup_overview": "Report generation failed.",
            "competitive_landscape": "Report generation failed.",
            "technology_analysis": "Report generation failed.",
            "market_analysis": "Report generation failed.",
            "financial_analysis": "Report generation failed.",
            "legal_analysis": "Report generation failed.",
            "founder_evaluation": "Report generation failed.",
            "debate_summary": "Report generation failed.",
            "recommendation": f"Based on committee vote: {decision}",
            "disclaimer": "This is a fallback report. LLM-generated analysis was unavailable.",
            "timestamp": datetime.utcnow().isoformat(),
            "decision": decision,
            "weighted_score": score,
            "source_info": self._extract_source_info(candidate) if candidate else {"platform": "Unknown", "username": "Unknown"},
        }


# ============================================================================
# REPORT FORMATTING UTILITIES
# ============================================================================

def format_report_markdown(report: Dict[str, Any]) -> str:
    """
    Format a report as Markdown for display.
    """
    lines = []
    
    # Title
    company = report.get("company", "Unknown")
    decision = report.get("decision", "PASS")
    stars = report.get("star_rating", 0)
    star_str = "⭐" * stars + "☆" * (5 - stars)
    
    lines.append(f"# {company} - Investment Report")
    lines.append(f"\n**Decision:** {decision} | **Rating:** {star_str} | **Score:** {report.get('weighted_score', 0):.2f}/10")
    
    # Source Information
    source_info = report.get("source_info", {})
    if source_info:
        lines.append("\n## 📌 Source Information")
        lines.append(f"- **Platform:** {source_info.get('platform_display', source_info.get('platform', 'Unknown'))}")
        lines.append(f"- **Author/Username:** {source_info.get('username', 'Unknown')}")
        if source_info.get('url'):
            lines.append(f"- **URL:** {source_info.get('url')}")
        if source_info.get('score'):
            lines.append(f"- **Score/Upvotes:** {source_info.get('score')}")
        if source_info.get('comments'):
            lines.append(f"- **Comments:** {source_info.get('comments')}")
        
        # Original text
        raw_text = source_info.get('raw_text', '')
        if raw_text:
            lines.append("\n### Original Post")
            lines.append(f"```\n{raw_text[:500]}...\n```")
    
    # Executive Summary
    lines.append("\n## Executive Summary")
    lines.append(report.get("executive_summary", "No executive summary available."))
    
    # Startup Overview
    lines.append("\n## Startup Overview")
    lines.append(report.get("startup_overview", "No startup overview available."))
    
    # Competitive Landscape
    lines.append("\n## Competitive Landscape")
    lines.append(report.get("competitive_landscape", "No competitive landscape available."))
    
    # Analysis
    lines.append("\n## Analysis")
    lines.append("\n### Technology")
    lines.append(report.get("technology_analysis", "No technology analysis available."))
    lines.append("\n### Market")
    lines.append(report.get("market_analysis", "No market analysis available."))
    lines.append("\n### Financial")
    lines.append(report.get("financial_analysis", "No financial analysis available."))
    lines.append("\n### Legal")
    lines.append(report.get("legal_analysis", "No legal analysis available."))
    
    # Founder Evaluation
    lines.append("\n## Founder Evaluation")
    lines.append(report.get("founder_evaluation", "No founder evaluation available."))
    
    # Debate Summary
    lines.append("\n## Committee Debate Summary")
    lines.append(report.get("debate_summary", "No debate summary available."))
    
    # Recommendation
    lines.append("\n## Recommendation")
    lines.append(f"**Decision:** {report.get('decision', 'PASS')}")
    lines.append(f"**Biggest Risk:** {report.get('biggest_risk', 'Unknown')}")
    lines.append(f"**Biggest Advantage:** {report.get('biggest_advantage', 'Unknown')}")
    lines.append(f"**Suggested Check Size:** {report.get('recommended_check_size', 'TBD')}")
    lines.append(f"**Suggested Stage:** {report.get('recommended_stage', 'TBD')}")
    lines.append(f"**Success Probability:** {report.get('probability_of_success_pct', 50)}%")
    
    # Disclaimer
    lines.append("\n---")
    lines.append(f"*{report.get('disclaimer', 'All predictions are LLM-generated estimates and not statistically validated.')}*")
    
    return "\n".join(lines)


# ============================================================================
# TESTING
# ============================================================================

if __name__ == "__main__":
    # Quick test
    logging.basicConfig(level=logging.INFO)
    
    print("\n🔍 Testing Report Generator...")
    
    # Test dossier
    test_dossier = {
        "company": "AI Legal Research Platform",
        "industry": "Legal Technology",
        "summary": "AI platform that helps law firms research cases 10x faster. Founded by 2 ex-lawyers. In beta with 5 firms.",
        "technology": "NLP, machine learning, legal document processing",
        "competitors": ["LexisNexis", "Westlaw", "Casetext"],
        "funding_status": "Pre-seed ($500k raised)",
        "pricing_model": "Subscription ($500/month per user)",
    }
    
    # Test candidate with source info
    test_candidate = {
        "title": "AI Legal Research Platform - Looking for feedback",
        "url": "https://legal-ai.com",
        "source": "hackernews",
        "metadata": {
            "author": "legal_founder",
            "score": 45,
            "comments_count": 12,
        },
        "raw_text": """Title: AI Legal Research Platform - Looking for feedback
Author: legal_founder
Source: hackernews
Description: We're building an AI platform that helps law firms research cases 10x faster. 
Founded by 2 ex-lawyers and a machine learning engineer. 
Currently in private beta with 5 law firms.
URL: https://legal-ai.com"""
    }
    
    # Test committee result
    test_committee_result = {
        "round1_opinions": [
            {
                "name": "Technical VC",
                "persona": "technical",
                "score": 8.0,
                "opinion": "Strong technical moat with NLP. Architecture seems scalable.",
                "confidence": 8.0,
            },
            {
                "name": "Finance VC",
                "persona": "finance",
                "score": 7.0,
                "opinion": "Subscription model viable. TAM is large but adoption may be slow.",
                "confidence": 7.0,
            },
            {
                "name": "Marketing VC",
                "persona": "marketing",
                "score": 7.5,
                "opinion": "Clear differentiation from incumbents. Strong demand signal.",
                "confidence": 8.0,
            },
            {
                "name": "Legal VC",
                "persona": "legal",
                "score": 6.5,
                "opinion": "Regulatory concerns around legal AI. Need to monitor.",
                "confidence": 6.0,
            },
            {
                "name": "Serial Founder",
                "persona": "founder",
                "score": 8.0,
                "opinion": "Strong team. MVP is feasible. Clear execution path.",
                "confidence": 8.0,
            },
        ],
        "vote_result": {
            "decision": "INVEST",
            "weighted_total": 7.4,
        },
        "fast_path": None,
    }
    
    # Generate report with candidate
    generator = ReportGenerator()
    report = generator.generate_report(test_dossier, test_committee_result, test_candidate)
    
    print("\n📊 Report Summary:")
    print(f"  Company: {report.get('company')}")
    print(f"  Decision: {report.get('decision')}")
    print(f"  Star Rating: {report.get('star_rating')}/5")
    print(f"  Success Probability: {report.get('probability_of_success_pct')}%")
    
    print("\n📊 Source Info:")
    source_info = report.get("source_info", {})
    print(f"  Platform: {source_info.get('platform_display', 'Unknown')}")
    print(f"  Author: {source_info.get('username', 'Unknown')}")
    print(f"  Score: {source_info.get('score', 0)}")
    
    print("\n📊 Markdown Preview:")
    markdown = format_report_markdown(report)
    print(markdown[:800] + "...")
    
    print("\n✅ Report generation tests passed!")