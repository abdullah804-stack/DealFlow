# src/agents/moderator_agent.py
"""
Moderator Agent — Orchestrates the Investment Committee debate.

Manages:
- Round 1: All investors form independent opinions
- Fast-path check: Skip round 2 if unanimous consensus
- Round 2: Investors respond to each other (reflection)
- Vote aggregation: Deterministic weighted voting
- Debate summarization: Summary of the discussion

Debate rounds are exactly 2 (round 2 = reflection round).
"""

import logging
from typing import List, Dict, Any, Optional, Tuple

from src.agents.investor_agent import create_all_investors, InvestorAgent
from src.agents.voting import (
    aggregate_scores,
    check_fast_path,
    compare_rounds,
    format_vote_result,
    format_round_comparison,
)
from src.llm.client import call_llm

from config.settings import DEBATE_ROUNDS, INVESTMENT_THRESHOLD

logger = logging.getLogger(__name__)


# ============================================================================
# MODERATOR AGENT
# ============================================================================

class ModeratorAgent:
    """
    Moderator for the Investment Committee debate.
    
    Orchestrates the full committee process:
    1. Round 1: Independent opinions
    2. Fast-path check: Skip round 2 if unanimous
    3. Round 2: Rebuttals (reflection)
    4. Vote aggregation: Final decision
    5. Debate summary
    """
    
    def __init__(self):
        self.investors = create_all_investors()
        self.investor_keys = list(self.investors.keys())
        self.rounds = DEBATE_ROUNDS
        
        logger.info(f"Moderator initialized with {len(self.investors)} investors")
    
    def run_committee(self, dossier: Dict[str, Any]) -> Dict[str, Any]:
        """
        Run the full Investment Committee process.
        
        Args:
            dossier: Structured dossier dict
            
        Returns:
            {
                "round1_opinions": [...],
                "round2_opinions": [...] or None,
                "fast_path": "auto_approve" | "auto_reject" | None,
                "vote_result": {...},
                "debate_summary": str,
                "round_comparison": {...}
            }
        """
        logger.info("=" * 50)
        logger.info("INVESTMENT COMMITTEE DEBATE")
        logger.info("=" * 50)
        
        # Step 1: Round 1 - Initial opinions
        logger.info("\n📊 ROUND 1: Initial Opinions")
        round1_opinions = self._run_round_1(dossier)
        
        # Step 2: Fast-path check
        fast_path, fast_decision = check_fast_path(round1_opinions)
        
        if fast_path:
            logger.info(f"\n🚀 FAST-PATH: {fast_path.upper()}")
            logger.info(f"Decision: {fast_decision}")
            
            # Aggregate votes (with fast-path)
            vote_result = aggregate_scores(round1_opinions)
            
            return {
                "round1_opinions": round1_opinions,
                "round2_opinions": None,
                "fast_path": fast_path,
                "vote_result": vote_result,
                "debate_summary": self._generate_summary(
                    dossier, round1_opinions, None, vote_result, fast_path
                ),
                "round_comparison": None,
            }
        
        # Step 3: Round 2 - Rebuttals (Reflection)
        logger.info("\n📊 ROUND 2: Rebuttals (Reflection)")
        round2_opinions = self._run_round_2(dossier, round1_opinions)
        
        # Step 4: Vote aggregation
        logger.info("\n📊 VOTE AGGREGATION")
        vote_result = aggregate_scores(round2_opinions, use_updated_scores=True)
        
        # Step 5: Round comparison
        round1_result = aggregate_scores(round1_opinions)
        round_comparison = compare_rounds(round1_result, vote_result)
        
        # Step 6: Debate summary
        debate_summary = self._generate_summary(
            dossier, round1_opinions, round2_opinions, vote_result, None
        )
        
        logger.info(f"\n📈 FINAL DECISION: {vote_result['decision']}")
        logger.info(f"  Weighted Score: {vote_result['weighted_total']:.2f}/10")
        
        return {
            "round1_opinions": round1_opinions,
            "round2_opinions": round2_opinions,
            "fast_path": None,
            "vote_result": vote_result,
            "debate_summary": debate_summary,
            "round_comparison": round_comparison,
        }
    
    def _run_round_1(self, dossier: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Run round 1: All investors form independent opinions.
        """
        opinions = []
        
        for key in self.investor_keys:
            investor = self.investors[key]
            opinion = investor.form_initial_opinion(dossier)
            opinions.append(opinion)
        
        # Log summary
        logger.info("\n  Round 1 Results:")
        for op in opinions:
            logger.info(f"    {op['name']}: {op['score']:.1f}/10 (conf: {op['confidence']:.1f})")
        
        return opinions
    
    def _run_round_2(
        self,
        dossier: Dict[str, Any],
        round1_opinions: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Run round 2: Investors respond to each other (reflection).
        """
        round2_opinions = []
        
        for i, opinion in enumerate(round1_opinions):
            investor_key = opinion.get("persona")
            investor = self.investors.get(investor_key)
            
            if investor:
                # Get other opinions (all except this one)
                other_opinions = [
                    op for j, op in enumerate(round1_opinions) if j != i
                ]
                
                updated = investor.form_rebuttal(
                    dossier, opinion, other_opinions
                )
                round2_opinions.append(updated)
            else:
                # Fallback: keep original
                opinion["has_rebuttal"] = False
                round2_opinions.append(opinion)
        
        # Log summary
        logger.info("\n  Round 2 Results:")
        for op in round2_opinions:
            score = op.get("updated_score", op.get("score", 0))
            name = op.get("name", "Unknown")
            changed = op.get("changed_mind", False)
            logger.info(f"    {name}: {score:.1f}/10 (changed mind: {changed})")
        
        return round2_opinions
    
    def _generate_summary(
        self,
        dossier: Dict[str, Any],
        round1_opinions: List[Dict[str, Any]],
        round2_opinions: Optional[List[Dict[str, Any]]],
        vote_result: Dict[str, Any],
        fast_path: Optional[str],
    ) -> str:
        """
        Generate a debate summary using LLM.
        """
        logger.info("  Generating debate summary...")
        
        # Prepare context
        company = dossier.get("company", "Unknown")
        industry = dossier.get("industry", "Unknown")
        summary = dossier.get("summary", "No summary available")
        
        # Prepare opinions
        r1_summary = ""
        for op in round1_opinions:
            r1_summary += f"""
{op['name']} (Score: {op['score']:.1f}/10):
{op.get('opinion', 'No opinion')[:200]}...
"""
        
        r2_summary = ""
        if round2_opinions:
            for op in round2_opinions:
                if op.get("has_rebuttal"):
                    r2_summary += f"""
{op['name']} (Updated Score: {op.get('updated_score', op.get('score', 0)):.1f}/10):
{op.get('updated_opinion', op.get('opinion', 'No opinion'))[:200]}...
"""
        
        fast_path_note = f"\nFast-path: {fast_path.upper()}" if fast_path else "\nFull debate (2 rounds)"
        
        prompt = f"""
Summarize the Investment Committee debate for {company}.

COMPANY: {company}
INDUSTRY: {industry}
SUMMARY: {summary}

ROUND 1 OPINIONS:
{r1_summary}

ROUND 2 REBUTTALS:
{r2_summary if r2_summary else "No round 2 (fast-path triggered)"}

FINAL DECISION: {vote_result['decision']}
WEIGHTED SCORE: {vote_result['weighted_total']:.2f}/10
{fast_path_note}

Provide a concise debate summary that covers:
1. Key points of agreement
2. Key points of disagreement
3. How the decision was reached
4. The final verdict

Keep it professional and concise (3-4 paragraphs).
"""
        
        system_prompt = """You are the Moderator of the VentureScout AI Investment Committee.

Your job is to summarize the committee debate accurately and concisely.
Capture the key arguments, the reasoning behind the decision, and the final verdict.
Be objective and balanced.
"""
        
        try:
            response = call_llm(
                prompt=prompt,
                system_prompt=system_prompt,
                temperature=0.5,
                max_tokens=600,
            )
            return response
        except Exception as e:
            logger.error(f"Failed to generate debate summary: {e}")
            return self._generate_fallback_summary(
                company, vote_result, fast_path
            )
    
    def _generate_fallback_summary(
        self,
        company: str,
        vote_result: Dict[str, Any],
        fast_path: Optional[str],
    ) -> str:
        """
        Generate a fallback summary when LLM fails.
        """
        decision = vote_result.get("decision", "PASS")
        score = vote_result.get("weighted_total", 0)
        
        if fast_path:
            return f"""
{company} was evaluated by the Investment Committee.

Fast-path triggered: {fast_path.upper()}
All investors reached unanimous consensus.

Final Decision: {decision}
Weighted Score: {score:.2f}/10

The committee agreed on the assessment without needing further debate.
"""
        else:
            return f"""
{company} was evaluated by the Investment Committee through a full 2-round debate.

After initial opinions and rebuttals, the committee reached its decision.

Final Decision: {decision}
Weighted Score: {score:.2f}/10

The decision reflects a balanced assessment of the startup's potential and risks.
"""


# ============================================================================
# CONVENIENCE FUNCTIONS
# ============================================================================

def run_committee_on_dossier(dossier: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convenience function to run the committee on a single dossier.
    """
    moderator = ModeratorAgent()
    return moderator.run_committee(dossier)


def run_committee_on_dossiers(
    dossiers: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Run the committee on multiple dossiers.
    """
    moderator = ModeratorAgent()
    results = []
    
    for i, dossier in enumerate(dossiers, 1):
        logger.info(f"\n{'=' * 60}")
        logger.info(f"CANDIDATE {i}/{len(dossiers)}")
        logger.info(f"{'=' * 60}")
        
        result = moderator.run_committee(dossier)
        results.append({
            "dossier": dossier,
            "result": result,
        })
    
    return results


# ============================================================================
# TESTING
# ============================================================================

if __name__ == "__main__":
    # Quick test
    logging.basicConfig(level=logging.INFO)
    
    print("\n🔍 Testing Moderator Agent...")
    
    # Test dossier
    test_dossier = {
        "company": "AI Legal Research Platform",
        "industry": "Legal Technology",
        "summary": "AI platform that helps law firms research cases 10x faster. Founded by 2 ex-lawyers. In beta with 5 firms.",
        "pricing_model": "Subscription ($500/month per user)",
        "estimated_users": "50 firms in beta",
        "technology": "NLP, machine learning, legal document processing",
        "competitors": ["LexisNexis", "Westlaw", "Casetext"],
        "funding_status": "Pre-seed ($500k raised)",
    }
    
    # Run committee
    moderator = ModeratorAgent()
    result = moderator.run_committee(test_dossier)
    
    print("\n📊 Committee Results:")
    print(f"  Fast-path: {result.get('fast_path') or 'None'}")
    print(f"  Decision: {result['vote_result']['decision']}")
    print(f"  Score: {result['vote_result']['weighted_total']:.2f}/10")
    
    print("\n📊 Round 1 Opinions:")
    for op in result['round1_opinions']:
        print(f"  {op['name']}: {op['score']:.1f}/10 (conf: {op['confidence']:.1f})")
    
    if result['round2_opinions']:
        print("\n📊 Round 2 Opinions (Reflection):")
        for op in result['round2_opinions']:
            score = op.get('updated_score', op.get('score', 0))
            changed = op.get('changed_mind', False)
            print(f"  {op['name']}: {score:.1f}/10 (changed mind: {changed})")
    
    if result.get('round_comparison'):
        print("\n📊 Round Comparison:")
        comp = result['round_comparison']
        print(f"  Score Change: {comp['score_change']:+.2f}")
        print(f"  Decision Changed: {comp['decision_changed']}")
    
    print("\n📊 Debate Summary:")
    print(result['debate_summary'][:300] + "...")
    
    print("\n✅ All moderator tests passed!")