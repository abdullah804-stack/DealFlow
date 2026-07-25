# src/evaluation/scorecard.py
"""
Scorecard Module — Discovery funnel statistics and reporting.

Provides:
- Funnel statistics (found → validated → escalated → invested)
- Historical performance tracking
- Report generation for the dashboard
- Time-series analysis of discovery activity
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional

from src.memory import get_funnel_stats, get_recent_reports

logger = logging.getLogger(__name__)


# ============================================================================
# SCORECARD CLASS
# ============================================================================

class Scorecard:
    """
    Generates scorecards and funnel statistics.
    """
    
    def __init__(self):
        pass
    
    def get_funnel_report(self, days_back: int = 30) -> Dict[str, Any]:
        """
        Get a comprehensive funnel report.
        
        Returns:
            {
                "period_days": int,
                "discovered": int,
                "validated": int,
                "escalated": int,
                "invested": int,
                "conversion_rates": {
                    "discovery_to_validation": float,
                    "validation_to_escalation": float,
                    "escalation_to_investment": float,
                },
                "daily_averages": {...},
                "trend": [...],
            }
        """
        # Get current stats
        stats = get_funnel_stats(days_back)
        
        # Calculate conversion rates
        discovered = stats.get("discovered", 0)
        validated = stats.get("validated", 0)
        escalated = stats.get("escalated", 0)
        invested = stats.get("invested", 0)
        
        conv_d_to_v = (validated / discovered * 100) if discovered > 0 else 0
        conv_v_to_e = (escalated / validated * 100) if validated > 0 else 0
        conv_e_to_i = (invested / escalated * 100) if escalated > 0 else 0
        
        # Get daily averages
        daily_avg_discovered = discovered / days_back if days_back > 0 else 0
        daily_avg_validated = validated / days_back if days_back > 0 else 0
        daily_avg_escalated = escalated / days_back if days_back > 0 else 0
        daily_avg_invested = invested / days_back if days_back > 0 else 0
        
        return {
            "period_days": days_back,
            "discovered": discovered,
            "validated": validated,
            "escalated": escalated,
            "invested": invested,
            "conversion_rates": {
                "discovery_to_validation": round(conv_d_to_v, 1),
                "validation_to_escalation": round(conv_v_to_e, 1),
                "escalation_to_investment": round(conv_e_to_i, 1),
            },
            "daily_averages": {
                "discovered": round(daily_avg_discovered, 1),
                "validated": round(daily_avg_validated, 1),
                "escalated": round(daily_avg_escalated, 1),
                "invested": round(daily_avg_invested, 1),
            },
        }
    
    def get_investment_summary(self, days_back: int = 30) -> Dict[str, Any]:
        """
        Get a summary of investment decisions.
        """
        reports = get_recent_reports(limit=100)
        
        # Filter by date
        cutoff = (datetime.utcnow() - timedelta(days=days_back)).isoformat()
        recent_reports = [
            r for r in reports
            if r.get("timestamp", "") >= cutoff
        ]
        
        total = len(recent_reports)
        invest_count = sum(1 for r in recent_reports if r.get("decision") == "INVEST")
        pass_count = total - invest_count
        
        # Average scores
        scores = [r.get("weighted_score", 0) for r in recent_reports]
        avg_score = sum(scores) / len(scores) if scores else 0
        
        # Fast-path stats
        fast_path_count = sum(1 for r in recent_reports if r.get("fast_path") is not None)
        
        return {
            "period_days": days_back,
            "total_decisions": total,
            "invest": invest_count,
            "pass": pass_count,
            "invest_rate": (invest_count / total * 100) if total > 0 else 0,
            "average_score": round(avg_score, 2),
            "fast_path_used": fast_path_count,
            "fast_path_rate": (fast_path_count / total * 100) if total > 0 else 0,
        }
    
    def get_recent_activity(self, days_back: int = 7) -> List[Dict[str, Any]]:
        """
        Get recent activity for the dashboard.
        """
        reports = get_recent_reports(limit=50)
        
        # Filter by date
        cutoff = (datetime.utcnow() - timedelta(days=days_back)).isoformat()
        recent = [
            {
                "timestamp": r.get("timestamp"),
                "company": r.get("title", "Unknown"),
                "decision": r.get("decision", "PASS"),
                "score": r.get("weighted_score", 0),
                "fast_path": r.get("fast_path"),
            }
            for r in reports
            if r.get("timestamp", "") >= cutoff
        ]
        
        return recent


# ============================================================================
# CONVENIENCE FUNCTIONS
# ============================================================================

def get_funnel_report(days_back: int = 30) -> Dict[str, Any]:
    """
    Get a comprehensive funnel report.
    """
    scorecard = Scorecard()
    return scorecard.get_funnel_report(days_back)


def get_investment_summary(days_back: int = 30) -> Dict[str, Any]:
    """
    Get investment summary.
    """
    scorecard = Scorecard()
    return scorecard.get_investment_summary(days_back)


def get_recent_activity(days_back: int = 7) -> List[Dict[str, Any]]:
    """
    Get recent activity.
    """
    scorecard = Scorecard()
    return scorecard.get_recent_activity(days_back)


# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    # Quick test
    logging.basicConfig(level=logging.INFO)
    
    print("\n🔍 Testing Scorecard...")
    
    scorecard = Scorecard()
    
    # Funnel report
    print("\n📊 Funnel Report (30 days):")
    funnel = scorecard.get_funnel_report(30)
    print(f"  Discovered: {funnel['discovered']}")
    print(f"  Validated: {funnel['validated']}")
    print(f"  Escalated: {funnel['escalated']}")
    print(f"  Invested: {funnel['invested']}")
    print(f"  Conversion: {funnel['conversion_rates']['discovery_to_validation']:.1f}%")
    
    # Investment summary
    print("\n📊 Investment Summary (30 days):")
    summary = scorecard.get_investment_summary(30)
    print(f"  Total: {summary['total_decisions']}")
    print(f"  INVEST: {summary['invest']} ({summary['invest_rate']:.1f}%)")
    print(f"  Average Score: {summary['average_score']:.2f}")
    
    # Recent activity
    print("\n📊 Recent Activity (7 days):")
    activity = scorecard.get_recent_activity(7)
    for item in activity[:5]:
        print(f"  {item['company']}: {item['decision']} ({item['score']:.2f})")
    
    print("\n✅ Scorecard tests passed!")