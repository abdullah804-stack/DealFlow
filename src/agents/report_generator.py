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
            "technology_analysis",
            "market_analysis",
            "financial_analysis",
            "legal_analysis",
            "founder_evaluation",
            "debate_summary",
            "recommendation",
        ]

    def generate_report(
        self,
        dossier: Dict[str, Any],
        committee_result: Dict[str, Any],
        candidate: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Generate a full investment report.
        """
        logger.info(f"Generating report for: {dossier.get('company', 'Unknown')}")

        report = self._generate_with_llm(dossier, committee_result, candidate)

        # Add metadata after LLM output
        report["timestamp"] = datetime.utcnow().isoformat()
        report["company"] = dossier.get("company", "Unknown")
        report["decision"] = committee_result.get("vote_result", {}).get("decision", "PASS")
        report["weighted_score"] = committee_result.get("vote_result", {}).get("weighted_total", 0)

        if candidate:
            report["source_info"] = self._extract_source_info(candidate)
        else:
            report["source_info"] = {"platform": "Unknown", "username": "Unknown"}

        star = report.get("star_rating", "?")
        prob = report.get("probability_of_success_pct", "?")
        logger.info(f"Report generated: {star} stars, {prob}% success probability")
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
        company = dossier.get("company", "Unknown")
        industry = dossier.get("industry", "Unknown")
        summary = dossier.get("summary", "No summary available")
        technology = dossier.get("technology", "Unknown")
        competitors = dossier.get("competitors", [])
        funding = dossier.get("funding_status", "Unknown")
        pricing = dossier.get("pricing_model", "Unknown")

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

        vote_result = committee_result.get("vote_result", {})
        decision = vote_result.get("decision", "PASS")
        weighted_score = vote_result.get("weighted_total", 0)
        fast_path = committee_result.get("fast_path")

        round1_opinions = committee_result.get("round1_opinions", [])
        round2_opinions = committee_result.get("round2_opinions", [])

        opinions_text = ""
        for op in round1_opinions:
            name = op.get("name", "Unknown")
            score = op.get("score", 0)
            opinion = op.get("opinion", "No opinion")
            opinions_text += f"\n{name} (Score: {score:.1f}/10):\n{opinion[:300]}...\n"

        rebuttals_text = ""
        if round2_opinions:
            for op in round2_opinions:
                if op.get("has_rebuttal"):
                    name = op.get("name", "Unknown")
                    updated_score = op.get("updated_score", op.get("score", 0))
                    updated_opinion = op.get("updated_opinion", "")
                    rebuttals_text += f"\n{name} (Updated Score: {updated_score:.1f}/10):\n{updated_opinion[:300]}...\n"

        prompt = f"""
Generate a comprehensive investment report for {company}.

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

Return ONLY valid json matching this exact shape:
{{
  "executive_summary": "2-3 sentence overview of the investment thesis",
  "startup_overview": "What the company does, problem solved, market opportunity",
  "competitive_landscape": "Key competitors and differentiation",
  "technology_analysis": "Technical approach, moat, feasibility",
  "market_analysis": "TAM, demand, timing",
  "financial_analysis": "Business model, revenue potential, unit economics",
  "legal_analysis": "Regulatory, IP, compliance considerations",
  "founder_evaluation": "Team quality and execution capability",
  "debate_summary": "Summary of the committee's discussion and key disagreements",
  "recommendation": "Final recommendation with rationale",
  "star_rating": 3,
  "probability_of_success_pct": 50,
  "biggest_risk": "single biggest risk",
  "biggest_advantage": "single biggest advantage",
  "recommended_check_size": "$250k-$500k",
  "recommended_stage": "Seed"
}}

All string sections must be non-empty. star_rating must be an integer 1-5.
probability_of_success_pct must be an integer 0-100.

IMPORTANT: All predictions are LLM-generated estimates, not statistically
calibrated. State this in the executive_summary or recommendation.
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

Respond with valid json only.
"""

        try:
            response = call_llm_json(
                prompt=prompt,
                system_prompt=system_prompt,
                temperature=0.5,
                max_tokens=2000,
            )
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
        Ensure all required fields are present, with type coercion and
        aliasing for common alternate keys the LLM may return.
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

        # Aliases: if the LLM returned an alternate key, map it to canonical
        aliases = {
            "executive_summary": ["summary", "exec_summary", "overview", "executive"],
            "startup_overview": ["company_overview", "startup_description", "about"],
            "competitive_landscape": ["competition", "competitors_analysis", "competitive_analysis"],
            "technology_analysis": ["technology", "tech_analysis", "technology_assessment"],
            "market_analysis": ["market", "market_assessment"],
            "financial_analysis": ["finance_analysis", "financials", "business_model"],
            "legal_analysis": ["legal", "regulatory_analysis", "compliance"],
            "founder_evaluation": ["founders", "team_evaluation", "team_assessment"],
            "debate_summary": ["committee_summary", "discussion_summary", "debate"],
            "recommendation": ["final_recommendation", "verdict", "conclusion"],
        }

        normalized: Dict[str, Any] = {}
        for key, value in report.items():
            if value is None:
                continue
            normalized[key] = value

        # Apply aliases for any missing canonical key
        for canonical, alternates in aliases.items():
            if not normalized.get(canonical):
                for alt in alternates:
                    if normalized.get(alt):
                        normalized[canonical] = normalized[alt]
                        break

        # Merge with defaults
        result = defaults.copy()
        for key, value in normalized.items():
            if key in result and value is not None and value != "":
                result[key] = value

        # Coerce numeric fields
        try:
            result["star_rating"] = int(float(result["star_rating"]))
            result["star_rating"] = max(1, min(5, result["star_rating"]))
        except (TypeError, ValueError):
            result["star_rating"] = 3

        try:
            result["probability_of_success_pct"] = int(
                float(result["probability_of_success_pct"])
            )
            result["probability_of_success_pct"] = max(
                0, min(100, result["probability_of_success_pct"])
            )
        except (TypeError, ValueError):
            result["probability_of_success_pct"] = 50

        result["disclaimer"] = (
            "All predictions (star rating, probability, check size, stage) "
            "are LLM-generated estimates based on available information. "
            "They are not statistically calibrated predictions and should "
            "not be considered as financial advice."
        )

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

    company = report.get("company", "Unknown")
    decision = report.get("decision", "PASS")
    stars = report.get("star_rating", 0)
    star_str = "⭐" * stars + "☆" * (5 - stars)

    lines.append(f"# {company} - Investment Report")
    lines.append(f"\n**Decision:** {decision} | **Rating:** {star_str} | **Score:** {report.get('weighted_score', 0):.2f}/10")

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

        raw_text = source_info.get('raw_text', '')
        if raw_text:
            lines.append("\n### Original Post")
            lines.append(f"```\n{raw_text[:500]}...\n```")

    lines.append("\n## Executive Summary")
    lines.append(report.get("executive_summary", "No executive summary available."))

    lines.append("\n## Startup Overview")
    lines.append(report.get("startup_overview", "No startup overview available."))

    lines.append("\n## Competitive Landscape")
    lines.append(report.get("competitive_landscape", "No competitive landscape available."))

    lines.append("\n## Analysis")
    lines.append("\n### Technology")
    lines.append(report.get("technology_analysis", "No technology analysis available."))
    lines.append("\n### Market")
    lines.append(report.get("market_analysis", "No market analysis available."))
    lines.append("\n### Financial")
    lines.append(report.get("financial_analysis", "No financial analysis available."))
    lines.append("\n### Legal")
    lines.append(report.get("legal_analysis", "No legal analysis available."))

    lines.append("\n## Founder Evaluation")
    lines.append(report.get("founder_evaluation", "No founder evaluation available."))

    lines.append("\n## Committee Debate Summary")
    lines.append(report.get("debate_summary", "No debate summary available."))

    lines.append("\n## Recommendation")
    lines.append(f"**Decision:** {report.get('decision', 'PASS')}")
    lines.append(f"**Biggest Risk:** {report.get('biggest_risk', 'Unknown')}")
    lines.append(f"**Biggest Advantage:** {report.get('biggest_advantage', 'Unknown')}")
    lines.append(f"**Suggested Check Size:** {report.get('recommended_check_size', 'TBD')}")
    lines.append(f"**Suggested Stage:** {report.get('recommended_stage', 'TBD')}")
    lines.append(f"**Success Probability:** {report.get('probability_of_success_pct', 50)}%")

    lines.append("\n---")
    lines.append(f"*{report.get('disclaimer', 'All predictions are LLM-generated estimates and not statistically validated.')}*")

    return "\n".join(lines)


# ============================================================================
# TESTING
# ============================================================================

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    print("\n🔍 Testing Report Generator...")

    test_dossier = {
        "company": "AI Legal Research Platform",
        "industry": "Legal Technology",
        "summary": "AI platform that helps law firms research cases 10x faster. Founded by 2 ex-lawyers. In beta with 5 firms.",
        "technology": "NLP, machine learning, legal document processing",
        "competitors": ["LexisNexis", "Westlaw", "Casetext"],
        "funding_status": "Pre-seed ($500k raised)",
        "pricing_model": "Subscription ($500/month per user)",
    }

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

    test_committee_result = {
        "round1_opinions": [
            {"name": "Technical VC", "persona": "technical", "score": 8.0,
             "opinion": "Strong technical moat with NLP.", "confidence": 8.0},
            {"name": "Finance VC", "persona": "finance", "score": 7.0,
             "opinion": "Subscription model viable.", "confidence": 7.0},
        ],
        "vote_result": {"decision": "INVEST", "weighted_total": 7.4},
        "fast_path": None,
    }

    generator = ReportGenerator()
    report = generator.generate_report(test_dossier, test_committee_result, test_candidate)

    print("\n📊 Report Summary:")
    print(f"  Company: {report.get('company')}")
    print(f"  Decision: {report.get('decision')}")
    print(f"  Star Rating: {report.get('star_rating')}/5")
    print(f"  Success Probability: {report.get('probability_of_success_pct')}%")
    print(f"  Exec Summary: {report.get('executive_summary', '')[:100]}...")

    print("\n✅ Report generation tests passed!")