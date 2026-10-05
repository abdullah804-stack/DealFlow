# src/evaluation/backtest.py
"""
Backtest Module — Historical accuracy demonstration.

Evaluates the Investment Committee against historical startups
with known outcomes. Each startup dossier contains ONLY information
available at the time (no outcome leakage).

The backtest demonstrates the committee's judgment mechanism,
not statistically rigorous validation.

Usage:
    python -m src.evaluation.backtest
"""

import logging
import sys
from pathlib import Path
from typing import List, Dict, Any, Optional

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from src.agents.dossier_builder import DossierBuilder
from src.agents.moderator_agent import ModeratorAgent
from src.memory import (
    get_backtest_results,
    save_backtest_result,
    clear_backtest_results,
)
from scripts.seed_backtest_startups import BACKTEST_STARTUPS, get_backtest_startups

logger = logging.getLogger(__name__)


# ============================================================================
# BACKTEST RUNNER
# ============================================================================

class BacktestRunner:
    """
    Runs the historical backtest.
    
    Each startup is evaluated by the committee using only period-appropriate
    information. The committee's verdict is compared to the actual outcome.
    """
    
    def __init__(self):
        self.dossier_builder = DossierBuilder()
        self.moderator = ModeratorAgent()
        self.results = []
    
    def run_backtest(self, clear_existing: bool = True) -> Dict[str, Any]:
        """
        Run the full backtest.
        
        Returns:
            {
                "total": int,
                "aligned": int,
                "accuracy_pct": float,
                "per_startup": [...],
                "details": [...],
            }
        """
        logger.info("=" * 60)
        logger.info("RUNNING BACKTEST")
        logger.info("=" * 60)
        
        # Clear existing results
        if clear_existing:
            clear_backtest_results()
        
        # Get startups
        startups = get_backtest_startups()
        logger.info(f"Evaluating {len(startups)} historical startups...")
        
        results = []
        aligned_count = 0
        
        for i, startup in enumerate(startups, 1):
            logger.info(f"\n📊 Evaluating {i}/{len(startups)}: {startup['name']}")
            
            try:
                result = self._evaluate_startup(startup)
                results.append(result)
                
                if result.get("aligned", False):
                    aligned_count += 1
                    
                logger.info(f"  Verdict: {result['committee_verdict']} (Aligned: {result['aligned']})")
                
            except Exception as e:
                logger.error(f"  Failed to evaluate {startup['name']}: {e}")
                results.append({
                    "startup_name": startup["name"],
                    "actual_outcome": startup["actual_outcome"],
                    "committee_verdict": "ERROR",
                    "aligned": False,
                    "error": str(e),
                })
        
        # Calculate accuracy
        total = len(results)
        accuracy_pct = (aligned_count / total * 100) if total > 0 else 0.0
        
        # Save results to memory
        for result in results:
            if "error" not in result:
                save_backtest_result(
                    startup_name=result["startup_name"],
                    actual_outcome=result["actual_outcome"],
                    committee_verdict=result["committee_verdict"],
                    aligned_with_outcome=result["aligned"],
                    dossier_text=result.get("dossier_text", ""),
                )
        
        # Summary
        logger.info("\n" + "=" * 60)
        logger.info("BACKTEST COMPLETE")
        logger.info("=" * 60)
        logger.info(f"  Total Startups: {total}")
        logger.info(f"  Aligned with Outcomes: {aligned_count}")
        logger.info(f"  Accuracy: {accuracy_pct:.1f}%")
        logger.info("  ⚠️  Note: Small sample size, demonstration only")
        
        return {
            "total": total,
            "aligned": aligned_count,
            "accuracy_pct": accuracy_pct,
            "per_startup": [
                {
                    "name": r["startup_name"],
                    "actual_outcome": r["actual_outcome"],
                    "committee_verdict": r["committee_verdict"],
                    "aligned": r["aligned"],
                }
                for r in results
            ],
            "details": results,
        }
    
    def _evaluate_startup(self, startup: Dict[str, Any]) -> Dict[str, Any]:
        """
        Evaluate a single startup through the committee.
        """
        # Build dossier from the text
        dossier_text = startup["dossier_text"]
        
        # Parse dossier text into structured format
        dossier = self._parse_dossier_text(dossier_text)
        
        # Run committee
        committee_result = self.moderator.run_committee(dossier)
        
        # Get verdict
        verdict = committee_result.get("vote_result", {}).get("decision", "PASS")
        
        # Compare with actual outcome
        actual_outcome = startup["actual_outcome"]
        
        # Determine if aligned:
        # - INVEST aligns with "succeeded" or "acquired"
        # - PASS aligns with "failed"
        if verdict == "INVEST" and actual_outcome in ["succeeded", "acquired"]:
            aligned = True
        elif verdict == "PASS" and actual_outcome == "failed":
            aligned = True
        else:
            aligned = False
        
        return {
            "startup_name": startup["name"],
            "actual_outcome": actual_outcome,
            "committee_verdict": verdict,
            "aligned": aligned,
            "dossier_text": dossier_text,
            "committee_result": committee_result,
            "dossier": dossier,
        }
    
    def _parse_dossier_text(self, text: str) -> Dict[str, Any]:
        """
        Parse the dossier text into structured format.
        """
        lines = text.strip().split("\n")
        
        dossier = {
            "company": "Unknown",
            "industry": "Unknown",
            "summary": "",
            "pricing_model": "Unknown",
            "estimated_users": "Unknown",
            "technology": "Unknown",
            "competitors": [],
            "funding_status": "Unknown",
        }
        
        current_key = None
        current_value = []
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            if ":" in line:
                # Save previous value
                if current_key and current_value:
                    dossier[current_key] = " ".join(current_value).strip()
                
                # New key
                parts = line.split(":", 1)
                key = parts[0].strip().lower().replace(" ", "_")
                value = parts[1].strip() if len(parts) > 1 else ""
                
                # Map to dossier fields
                mapping = {
                    "company": "company",
                    "industry": "industry",
                    "summary": "summary",
                    "pricing_model": "pricing_model",
                    "estimated_users": "estimated_users",
                    "technology": "technology",
                    "competitors": "competitors",
                    "funding_status": "funding_status",
                }
                
                if key in mapping:
                    current_key = mapping[key]
                    if value:
                        if current_key == "competitors" and value:
                            dossier[current_key] = [c.strip() for c in value.split(",")]
                        else:
                            current_value = [value]
                    else:
                        current_value = []
                else:
                    current_key = None
                    current_value = []
            else:
                # Append to current value
                if current_key and current_value is not None:
                    current_value.append(line)
        
        # Save final value
        if current_key and current_value:
            dossier[current_key] = " ".join(current_value).strip()
        
        # Ensure summary is populated
        if not dossier["summary"]:
            dossier["summary"] = text[:500]
        
        return dossier


# ============================================================================
# CONVENIENCE FUNCTIONS
# ============================================================================

def run_backtest() -> Dict[str, Any]:
    """
    Convenience function to run the backtest.
    """
    runner = BacktestRunner()
    return runner.run_backtest()


def get_backtest_summary() -> Dict[str, Any]:
    """
    Get the backtest summary from memory.
    """
    return get_backtest_results()


# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    # Set up logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )
    
    print("\n" + "=" * 60)
    print("DealFlow — BACKTEST")
    print("=" * 60)
    print("\n⚠️  This will run the full committee on 10 historical startups.")
    print("   Each startup will be evaluated as if it were a new candidate.")
    print("   This will make LLM calls and may take several minutes.")
    print("\n   Estimated time: 5-10 minutes")
    
    response = input("\nContinue? (y/N): ")
    if response.lower() != 'y':
        print("Cancelled.")
        sys.exit(0)
    
    # Run backtest
    result = run_backtest()
    
    print("\n" + "=" * 60)
    print("BACKTEST RESULTS")
    print("=" * 60)
    print(f"  Total Startups: {result['total']}")
    print(f"  Aligned with Outcomes: {result['aligned']}")
    print(f"  Accuracy: {result['accuracy_pct']:.1f}%")
    
    print("\n  Per-Startup Breakdown:")
    for startup in result['per_startup']:
        status = "✅" if startup['aligned'] else "❌"
        print(f"    {status} {startup['name']}: {startup['committee_verdict']} (Actual: {startup['actual_outcome']})")
    
    print("\n  ⚠️  IMPORTANT: This is a demonstration with a small sample size.")
    print("     Not a statistically rigorous evaluation.")
    
    print("\n✅ Backtest complete!")