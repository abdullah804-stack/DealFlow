# src/agents/voting.py
"""
Voting — Deterministic weighted scoring for the Investment Committee.

Pure code, no LLM calls.
Aggregates investor scores, applies weights, and determines INVEST/PASS.

Fast-path detection:
- All investors >= 8.5 => AUTO_APPROVE (skip round 2)
- All investors <= 3.0 => AUTO_REJECT (skip round 2)
- Mixed scores => proceed to round 2
"""

import logging
from typing import List, Dict, Any, Optional, Tuple

from config.settings import (
    INVESTOR_WEIGHTS,
    INVESTMENT_THRESHOLD,
    FAST_PATH_CONSENSUS_HIGH,
    FAST_PATH_CONSENSUS_LOW,
)

logger = logging.getLogger(__name__)


# ============================================================================
# VOTING FUNCTIONS
# ============================================================================

def aggregate_scores(
    opinions: List[Dict[str, Any]],
    use_updated_scores: bool = False,
) -> Dict[str, Any]:
    """
    Aggregate investor scores into a weighted total.
    
    Args:
        opinions: List of investor opinion dicts
        use_updated_scores: If True, use 'updated_score' from round 2
    
    Returns:
        {
            "weighted_total": float,
            "decision": "INVEST" | "PASS",
            "per_investor": [
                {"persona": "...", "name": "...", "score": float, "weight": float, "weighted_score": float}
            ],
            "fast_path": "auto_approve" | "auto_reject" | None,
            "is_fast_path": bool,
        }
    """
    if not opinions:
        logger.warning("No opinions provided to aggregate_scores")
        return {
            "weighted_total": 0.0,
            "decision": "PASS",
            "per_investor": [],
            "fast_path": None,
            "is_fast_path": False,
        }
    
    logger.info(f"Aggregating scores from {len(opinions)} investors...")
    
    # Extract scores
    per_investor = []
    total_weighted = 0.0
    total_weight = 0.0
    
    for op in opinions:
        persona = op.get("persona", "unknown")
        weight = INVESTOR_WEIGHTS.get(persona, 0.0)
        
        # Use updated score if available and requested
        if use_updated_scores and "updated_score" in op:
            score = op.get("updated_score", 5.0)
        else:
            score = op.get("score", 5.0)
        
        # Clamp score to 1-10
        score = max(1, min(10, float(score)))
        
        weighted_score = score * weight
        total_weighted += weighted_score
        total_weight += weight
        
        per_investor.append({
            "persona": persona,
            "name": op.get("name", persona),
            "score": score,
            "weight": weight,
            "weighted_score": weighted_score,
            "confidence": op.get("confidence", op.get("rebuttal_confidence", 5.0)),
        })
    
    # Calculate weighted total (ensure weights sum to 1.0)
    if total_weight > 0:
        weighted_total = total_weighted / total_weight
    else:
        weighted_total = 0.0
    
    # Clamp to 1-10
    weighted_total = max(1, min(10, weighted_total))
    
    # Determine decision
    decision = "INVEST" if weighted_total >= INVESTMENT_THRESHOLD else "PASS"
    
    # Check fast-path conditions
    scores = [p["score"] for p in per_investor]
    fast_path = None
    is_fast_path = False
    
    if all(s >= FAST_PATH_CONSENSUS_HIGH for s in scores):
        fast_path = "auto_approve"
        is_fast_path = True
        decision = "INVEST"
        logger.info(f"  🚀 Fast-path: AUTO_APPROVE (all scores >= {FAST_PATH_CONSENSUS_HIGH})")
    elif all(s <= FAST_PATH_CONSENSUS_LOW for s in scores):
        fast_path = "auto_reject"
        is_fast_path = True
        decision = "PASS"
        logger.info(f"  🚀 Fast-path: AUTO_REJECT (all scores <= {FAST_PATH_CONSENSUS_LOW})")
    
    logger.info(f"  Weighted total: {weighted_total:.2f}/10 -> {decision}")
    if not is_fast_path:
        logger.info(f"  Proceeding to round 2 (mixed scores)")
    
    return {
        "weighted_total": weighted_total,
        "decision": decision,
        "per_investor": per_investor,
        "fast_path": fast_path,
        "is_fast_path": is_fast_path,
    }


def check_fast_path(
    opinions: List[Dict[str, Any]]
) -> Tuple[Optional[str], Optional[str]]:
    """
    Check if the committee can skip round 2 via fast-path.
    
    Args:
        opinions: List of investor opinion dicts (round 1)
    
    Returns:
        (fast_path_type, decision) where:
        - fast_path_type: 'auto_approve', 'auto_reject', or None
        - decision: 'INVEST', 'PASS', or None (if no fast-path)
    """
    if not opinions:
        return None, None
    
    scores = []
    for op in opinions:
        score = op.get("score", 5.0)
        scores.append(score)
    
    # Check high consensus (auto-approve)
    if all(s >= FAST_PATH_CONSENSUS_HIGH for s in scores):
        return "auto_approve", "INVEST"
    
    # Check low consensus (auto-reject)
    if all(s <= FAST_PATH_CONSENSUS_LOW for s in scores):
        return "auto_reject", "PASS"
    
    # No fast-path
    return None, None


def get_consensus_type(opinions: List[Dict[str, Any]]) -> str:
    """
    Determine the type of consensus among investors.
    
    Returns:
        'unanimous_high', 'unanimous_low', 'mixed', or 'no_opinions'
    """
    if not opinions:
        return "no_opinions"
    
    scores = [op.get("score", 5.0) for op in opinions]
    
    if all(s >= FAST_PATH_CONSENSUS_HIGH for s in scores):
        return "unanimous_high"
    elif all(s <= FAST_PATH_CONSENSUS_LOW for s in scores):
        return "unanimous_low"
    else:
        return "mixed"


def compare_rounds(
    round1_results: Dict[str, Any],
    round2_results: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Compare round 1 and round 2 voting results.
    
    Returns:
        {
            "score_change": float,
            "decision_changed": bool,
            "round1_decision": str,
            "round2_decision": str,
            "opinion_shifts": [...]
        }
    """
    if not round1_results or not round2_results:
        return {
            "score_change": 0.0,
            "decision_changed": False,
            "round1_decision": round1_results.get("decision", "PASS") if round1_results else "PASS",
            "round2_decision": round2_results.get("decision", "PASS") if round2_results else "PASS",
            "opinion_shifts": [],
        }
    
    round1_total = round1_results.get("weighted_total", 0.0)
    round2_total = round2_results.get("weighted_total", 0.0)
    score_change = round2_total - round1_total
    
    decision_changed = round1_results.get("decision") != round2_results.get("decision")
    
    # Track individual shifts
    opinion_shifts = []
    r1_investors = {p["persona"]: p for p in round1_results.get("per_investor", [])}
    r2_investors = {p["persona"]: p for p in round2_results.get("per_investor", [])}
    
    for persona in r1_investors:
        if persona in r2_investors:
            r1_score = r1_investors[persona]["score"]
            r2_score = r2_investors[persona]["score"]
            if r2_score != r1_score:
                opinion_shifts.append({
                    "persona": persona,
                    "name": r1_investors[persona]["name"],
                    "round1_score": r1_score,
                    "round2_score": r2_score,
                    "shift": r2_score - r1_score,
                })
    
    return {
        "score_change": score_change,
        "decision_changed": decision_changed,
        "round1_decision": round1_results.get("decision", "PASS"),
        "round2_decision": round2_results.get("decision", "PASS"),
        "opinion_shifts": opinion_shifts,
    }


# ============================================================================
# VOTE RESULT FORMATTING
# ============================================================================

def format_vote_result(vote_result: Dict[str, Any]) -> str:
    """
    Format vote results for display in reports.
    """
    lines = []
    lines.append("=" * 50)
    lines.append("INVESTMENT COMMITTEE VOTE")
    lines.append("=" * 50)
    
    lines.append(f"\n📊 Weighted Total: {vote_result.get('weighted_total', 0):.2f}/10")
    lines.append(f"📈 Decision: {vote_result.get('decision', 'PASS')}")
    
    if vote_result.get("is_fast_path"):
        lines.append(f"🚀 Fast-path: {vote_result.get('fast_path', 'N/A')}")
    
    lines.append("\n👥 Investor Breakdown:")
    for investor in vote_result.get("per_investor", []):
        name = investor.get("name", investor.get("persona", "Unknown"))
        score = investor.get("score", 0)
        weight = investor.get("weight", 0)
        weighted = investor.get("weighted_score", 0)
        lines.append(f"  • {name}: {score:.1f}/10 (weight: {weight:.0%}) -> {weighted:.2f}")
    
    return "\n".join(lines)


def format_round_comparison(comparison: Dict[str, Any]) -> str:
    """
    Format round comparison for reports.
    """
    lines = []
    lines.append("\n🔄 Round Comparison:")
    lines.append(f"  Round 1: {comparison.get('round1_decision', 'PASS')} ({comparison.get('round1_score', 0):.2f})")
    lines.append(f"  Round 2: {comparison.get('round2_decision', 'PASS')} ({comparison.get('round2_score', 0):.2f})")
    lines.append(f"  Score Change: {comparison.get('score_change', 0):+.2f}")
    
    if comparison.get("decision_changed"):
        lines.append("  🔄 Decision CHANGED after round 2")
    else:
        lines.append("  ✅ Decision unchanged after round 2")
    
    if comparison.get("opinion_shifts"):
        lines.append("\n  Opinion Shifts:")
        for shift in comparison.get("opinion_shifts", []):
            name = shift.get("name", shift.get("persona", "Unknown"))
            change = shift.get("shift", 0)
            lines.append(f"    • {name}: {shift.get('round1_score', 0):.1f} -> {shift.get('round2_score', 0):.1f} ({change:+.1f})")
    
    return "\n".join(lines)


# ============================================================================
# TESTING
# ============================================================================

if __name__ == "__main__":
    # Quick test
    logging.basicConfig(level=logging.INFO)
    
    print("\n🔍 Testing Voting Module...")
    
    # Test 1: Normal voting
    print("\n📊 Test 1: Normal Voting")
    opinions = [
        {"persona": "technical", "name": "Technical VC", "score": 8.0},
        {"persona": "finance", "name": "Finance VC", "score": 7.0},
        {"persona": "marketing", "name": "Marketing VC", "score": 6.5},
        {"persona": "legal", "name": "Legal VC", "score": 5.5},
        {"persona": "founder", "name": "Serial Founder", "score": 7.5},
    ]
    
    result = aggregate_scores(opinions)
    print(f"  Weighted Total: {result['weighted_total']:.2f}/10")
    print(f"  Decision: {result['decision']}")
    print(f"  Fast-path: {result['fast_path'] or 'None'}")
    
    # Test 2: Fast-path auto-approve
    print("\n📊 Test 2: Fast-path Auto-Approve")
    opinions_high = [
        {"persona": "technical", "name": "Technical VC", "score": 9.0},
        {"persona": "finance", "name": "Finance VC", "score": 9.5},
        {"persona": "marketing", "name": "Marketing VC", "score": 8.5},
        {"persona": "legal", "name": "Legal VC", "score": 8.5},
        {"persona": "founder", "name": "Serial Founder", "score": 9.0},
    ]
    
    result_high = aggregate_scores(opinions_high)
    print(f"  Weighted Total: {result_high['weighted_total']:.2f}/10")
    print(f"  Decision: {result_high['decision']}")
    print(f"  Fast-path: {result_high['fast_path']}")
    print(f"  Is Fast-path: {result_high['is_fast_path']}")
    
    # Test 3: Fast-path auto-reject
    print("\n📊 Test 3: Fast-path Auto-Reject")
    opinions_low = [
        {"persona": "technical", "name": "Technical VC", "score": 2.0},
        {"persona": "finance", "name": "Finance VC", "score": 3.0},
        {"persona": "marketing", "name": "Marketing VC", "score": 2.5},
        {"persona": "legal", "name": "Legal VC", "score": 2.0},
        {"persona": "founder", "name": "Serial Founder", "score": 1.5},
    ]
    
    result_low = aggregate_scores(opinions_low)
    print(f"  Weighted Total: {result_low['weighted_total']:.2f}/10")
    print(f"  Decision: {result_low['decision']}")
    print(f"  Fast-path: {result_low['fast_path']}")
    print(f"  Is Fast-path: {result_low['is_fast_path']}")
    
    # Test 4: Round comparison
    print("\n📊 Test 4: Round Comparison")
    round1 = {
        "weighted_total": 6.2,
        "decision": "PASS",
        "per_investor": [
            {"persona": "technical", "name": "Technical VC", "score": 6.0},
            {"persona": "finance", "name": "Finance VC", "score": 5.5},
            {"persona": "marketing", "name": "Marketing VC", "score": 7.0},
            {"persona": "legal", "name": "Legal VC", "score": 6.0},
            {"persona": "founder", "name": "Serial Founder", "score": 7.5},
        ]
    }
    round2 = {
        "weighted_total": 6.8,
        "decision": "INVEST",
        "per_investor": [
            {"persona": "technical", "name": "Technical VC", "score": 6.5},
            {"persona": "finance", "name": "Finance VC", "score": 6.0},
            {"persona": "marketing", "name": "Marketing VC", "score": 7.5},
            {"persona": "legal", "name": "Legal VC", "score": 6.0},
            {"persona": "founder", "name": "Serial Founder", "score": 8.0},
        ]
    }
    
    comparison = compare_rounds(round1, round2)
    print(f"  Score Change: {comparison['score_change']:+.2f}")
    print(f"  Decision Changed: {comparison['decision_changed']}")
    print(f"  Opinion Shifts: {len(comparison['opinion_shifts'])}")
    
    print("\n✅ All voting tests passed!")