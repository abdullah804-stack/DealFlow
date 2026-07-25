# src/orchestration/daily_cycle.py
"""
Daily Cycle Orchestration — Runs the full VentureScout AI pipeline.

Executes:
1. Discovery: Pull candidates from all sources
2. Validation: Score, rank, and select top candidates
3. Dossier Building: Create structured dossiers for selected candidates
4. Committee: Run the Investment Committee debate
5. Report Generation: Create VC-memo-style reports

All results are stored in memory (structured + vector).
Cap: MAX_CANDIDATES_FULL_COMMITTEE_PER_DAY = 3
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

from src.agents.discovery_agent import DiscoveryAgent
from src.agents.validation_agent import ValidationAgent
from src.agents.dossier_builder import DossierBuilder
from src.agents.moderator_agent import ModeratorAgent
from src.agents.report_generator import ReportGenerator
from src.memory.memory_integration import MemoryIntegration

from config.settings import MAX_CANDIDATES_FULL_COMMITTEE_PER_DAY

logger = logging.getLogger(__name__)


# ============================================================================
# DAILY CYCLE CLASS
# ============================================================================

class DailyCycle:
    """
    Orchestrates the full daily cycle of VentureScout AI.
    """
    
    def __init__(self):
        self.discovery = DiscoveryAgent()
        self.validation = ValidationAgent()
        self.dossier_builder = DossierBuilder()
        self.moderator = ModeratorAgent()
        self.report_generator = ReportGenerator()
        self.memory = MemoryIntegration()
        
        self.results = {
            "timestamp": None,
            "candidates_found": 0,
            "candidates_validated": 0,
            "candidates_escalated": 0,
            "committee_candidates": [],
            "reports": [],
            "errors": [],
        }
    
    def run(self) -> Dict[str, Any]:
        """
        Run the full daily cycle.
        
        Returns:
            Dict with complete cycle results
        """
        logger.info("=" * 60)
        logger.info("STARTING DAILY CYCLE")
        logger.info("=" * 60)
        
        self.results["timestamp"] = datetime.utcnow().isoformat()
        
        # Step 1: Discovery
        logger.info("\n📊 STEP 1: DISCOVERY")
        candidates = self._run_discovery()
        self.results["candidates_found"] = len(candidates)
        
        if not candidates:
            logger.info("No candidates found. Cycle complete.")
            return self.results
        
        # Step 2: Validation
        logger.info("\n📊 STEP 2: VALIDATION")
        validated = self._run_validation(candidates)
        self.results["candidates_validated"] = len(validated.get("validated", []))
        self.results["candidates_escalated"] = len(validated.get("committee_candidates", []))
        
        committee_candidates = validated.get("committee_candidates", [])
        
        if not committee_candidates:
            logger.info("No candidates selected for committee. Cycle complete.")
            return self.results
        
        # Step 3: Committee and Reports (per candidate)
        logger.info(f"\n📊 STEP 3: COMMITTEE + REPORTS ({len(committee_candidates)} candidates)")
        
        for candidate in committee_candidates:
            try:
                result = self._process_candidate(candidate)
                self.results["committee_candidates"].append(result)
                
                if "report" in result:
                    self.results["reports"].append(result["report"])
                
            except Exception as e:
                error_msg = f"Failed to process {candidate.get('title', 'Unknown')}: {e}"
                logger.error(error_msg)
                self.results["errors"].append(error_msg)
        
        # Summary
        logger.info("\n" + "=" * 60)
        logger.info("DAILY CYCLE COMPLETE")
        logger.info("=" * 60)
        logger.info(f"  Candidates Found: {self.results['candidates_found']}")
        logger.info(f"  Candidates Validated: {self.results['candidates_validated']}")
        logger.info(f"  Candidates Escalated: {self.results['candidates_escalated']}")
        logger.info(f"  Reports Generated: {len(self.results['reports'])}")
        logger.info(f"  Errors: {len(self.results['errors'])}")
        
        return self.results
    
    def _run_discovery(self) -> List[Dict[str, Any]]:
        """
        Run the discovery pipeline.
        """
        try:
            candidates = self.discovery.run_discovery()
            logger.info(f"  Found {len(candidates)} candidates")
            return candidates
        except Exception as e:
            logger.error(f"  Discovery failed: {e}")
            return []
    
    def _run_validation(self, candidates: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Run the validation pipeline.
        """
        try:
            result = self.validation.run_validation(candidates)
            logger.info(f"  Validated: {len(result.get('validated', []))}")
            logger.info(f"  Shortlist: {len(result.get('shortlist', []))}")
            logger.info(f"  Committee: {len(result.get('committee_candidates', []))}")
            return result
        except Exception as e:
            logger.error(f"  Validation failed: {e}")
            return {"validated": [], "shortlist": [], "committee_candidates": []}
    
    def _process_candidate(self, candidate: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process a single candidate through the full pipeline.
        
        Steps:
        1. Build dossier
        2. Run committee
        3. Generate report (passing the candidate for source info)
        4. Save to memory
        """
        title = candidate.get("title", "Unknown")
        logger.info(f"\n  Processing: {title}")
        
        result = {
            "candidate": candidate,
            "dossier": None,
            "committee_result": None,
            "report": None,
            "memory_ids": {},
        }
        
        # Step 1: Build dossier
        try:
            dossier = self.dossier_builder.build_dossier(candidate)
            result["dossier"] = dossier
            logger.info(f"    ✅ Dossier built")
        except Exception as e:
            logger.error(f"    ❌ Dossier build failed: {e}")
            result["errors"] = [str(e)]
            return result
        
        # Step 2: Save dossier to memory
        try:
            candidate_id = candidate.get("db_id")
            if candidate_id:
                dossier_id = self.memory.save_dossier(candidate_id, dossier)
                result["memory_ids"]["dossier_id"] = dossier_id
                logger.info(f"    ✅ Dossier saved (ID: {dossier_id})")
        except Exception as e:
            logger.warning(f"    ⚠️ Failed to save dossier: {e}")
        
        # Step 3: Run committee
        try:
            committee_result = self.moderator.run_committee(dossier)
            result["committee_result"] = committee_result
            logger.info(f"    ✅ Committee complete: {committee_result.get('vote_result', {}).get('decision', 'N/A')}")
        except Exception as e:
            logger.error(f"    ❌ Committee failed: {e}")
            result["errors"] = result.get("errors", []) + [str(e)]
            return result
        
        # Step 4: Save committee decision to memory
        try:
            vote_result = committee_result.get("vote_result", {})
            if "dossier_id" in result["memory_ids"]:
                decision_id = self.memory.save_decision(
                    dossier_id=result["memory_ids"]["dossier_id"],
                    decision=vote_result.get("decision", "PASS"),
                    weighted_score=vote_result.get("weighted_total", 0),
                    fast_path=committee_result.get("fast_path"),
                    round1_opinions=committee_result.get("round1_opinions"),
                    round2_opinions=committee_result.get("round2_opinions"),
                    debate_summary=committee_result.get("debate_summary"),
                )
                result["memory_ids"]["decision_id"] = decision_id
                logger.info(f"    ✅ Decision saved (ID: {decision_id})")
        except Exception as e:
            logger.warning(f"    ⚠️ Failed to save decision: {e}")
        
        # Step 5: Generate report (PASS THE CANDIDATE FOR SOURCE INFO)
        try:
            report = self.report_generator.generate_report(
                dossier=dossier,
                committee_result=committee_result,
                candidate=candidate  # <-- THIS IS THE KEY CHANGE
            )
            result["report"] = report
            logger.info(f"    ✅ Report generated: {report.get('star_rating', 0)} stars")
            
            # Log source info if available
            source_info = report.get("source_info", {})
            if source_info:
                logger.info(f"    📌 Source: {source_info.get('platform_display', 'Unknown')} by {source_info.get('username', 'Unknown')}")
            
        except Exception as e:
            logger.error(f"    ❌ Report generation failed: {e}")
            result["errors"] = result.get("errors", []) + [str(e)]
        
        return result
    
    def get_summary(self) -> Dict[str, Any]:
        """
        Get a summary of the last cycle results.
        """
        return {
            "timestamp": self.results.get("timestamp"),
            "candidates_found": self.results.get("candidates_found", 0),
            "candidates_validated": self.results.get("candidates_validated", 0),
            "candidates_escalated": self.results.get("candidates_escalated", 0),
            "reports_generated": len(self.results.get("reports", [])),
            "errors": len(self.results.get("errors", [])),
        }


# ============================================================================
# CONVENIENCE FUNCTIONS
# ============================================================================

def run_daily_cycle() -> Dict[str, Any]:
    """
    Convenience function to run the daily cycle.
    """
    cycle = DailyCycle()
    return cycle.run()


def run_daily_cycle_with_logging() -> Dict[str, Any]:
    """
    Run the daily cycle with comprehensive logging.
    """
    logger.info("=" * 60)
    logger.info("VENTURESCOUT AI — DAILY CYCLE")
    logger.info("=" * 60)
    
    start_time = datetime.utcnow()
    result = run_daily_cycle()
    end_time = datetime.utcnow()
    
    duration = (end_time - start_time).total_seconds()
    logger.info(f"\n⏱️  Cycle completed in {duration:.2f} seconds")
    
    return result


# ============================================================================
# TESTING
# ============================================================================

if __name__ == "__main__":
    # Quick test
    logging.basicConfig(level=logging.INFO)
    
    print("\n🔍 Testing Daily Cycle...")
    print("⚠️  This will run the full pipeline with real sources.")
    print("    It may take several minutes and will make LLM calls.")
    
    response = input("\nContinue? (y/N): ")
    if response.lower() != 'y':
        print("Test cancelled.")
        exit()
    
    # Run the daily cycle
    result = run_daily_cycle()
    
    print("\n📊 Cycle Results:")
    print(f"  Candidates Found: {result.get('candidates_found', 0)}")
    print(f"  Candidates Validated: {result.get('candidates_validated', 0)}")
    print(f"  Candidates Escalated: {result.get('candidates_escalated', 0)}")
    print(f"  Reports Generated: {len(result.get('reports', []))}")
    print(f"  Errors: {len(result.get('errors', []))}")
    
    if result.get('reports'):
        print("\n📊 Generated Reports:")
        for i, report in enumerate(result['reports'], 1):
            company = report.get('company', 'Unknown')
            decision = report.get('decision', 'PASS')
            stars = report.get('star_rating', 0)
            source_info = report.get('source_info', {})
            source_display = source_info.get('platform_display', 'Unknown')
            username = source_info.get('username', 'Unknown')
            print(f"  {i}. {company}: {decision} (⭐{stars}/5) — from {source_display} by {username}")
    
    if result.get('errors'):
        print("\n⚠️  Errors:")
        for error in result['errors']:
            print(f"  - {error[:100]}...")
    
    print("\n✅ Daily cycle test complete!")