# src/scheduler/run_cycle.py
"""
Scheduler Entry Point — Runs the daily cycle.

This is the main entry point for the VentureScout AI daily cycle.
Can be run locally or via GitHub Actions.

Usage:
    python -m src.scheduler.run_cycle

Environment:
    GROQ_API_KEY: Required
    OPENROUTER_API_KEY: Required
"""

import os
import sys
import logging
import argparse
from datetime import datetime
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

# Load environment variables
from dotenv import load_dotenv
import os
from pathlib import Path

# Explicitly load .env from the project root
env_path = Path(__file__).resolve().parent.parent.parent / '.env'
print(f"Looking for .env at: {env_path}")
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
    print(f"✅ Loaded .env from: {env_path}")
else:
    print(f"⚠️ .env not found at: {env_path}")
    # Try current directory
    load_dotenv()

# Import configuration and orchestration
from config.settings import validate_config
from src.orchestration.daily_cycle import run_daily_cycle
from src.memory import init_memory


# ============================================================================
# LOGGING CONFIGURATION
# ============================================================================

def setup_logging(verbose: bool = False):
    """
    Set up logging for the scheduler.
    """
    log_level = logging.DEBUG if verbose else logging.INFO
    
    # Configure root logger
    logging.basicConfig(
        level=log_level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S',
    )
    
    # Set specific loggers
    logging.getLogger('src.llm.client').setLevel(logging.INFO)
    logging.getLogger('src.agents').setLevel(logging.INFO)
    logging.getLogger('src.orchestration').setLevel(logging.INFO)
    
    # Create logger
    logger = logging.getLogger(__name__)
    logger.info(f"Logging configured (level: {log_level})")
    return logger


# ============================================================================
# ENVIRONMENT CHECK
# ============================================================================

def check_environment():
    """
    Check that the environment is properly configured.
    """
    logger = logging.getLogger(__name__)
    
    # Check API keys
    groq_key = os.getenv("GROQ_API_KEY")
    openrouter_key = os.getenv("OPENROUTER_API_KEY")
    
    if not groq_key:
        logger.error("GROQ_API_KEY is not set")
        return False
    
    if not openrouter_key:
        logger.error("OPENROUTER_API_KEY is not set")
        return False
    
    logger.info(f"✅ GROQ_API_KEY: {'*' * 8}{groq_key[-4:]}")
    logger.info(f"✅ OPENROUTER_API_KEY: {'*' * 8}{openrouter_key[-4:]}")
    
    return True


# ============================================================================
# MAIN FUNCTION
# ============================================================================

def main():
    """
    Main entry point for the scheduler.
    """
    # Parse arguments
    parser = argparse.ArgumentParser(
        description='Run the VentureScout AI daily cycle.'
    )
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Enable verbose logging'
    )
    parser.add_argument(
        '--skip-init',
        action='store_true',
        help='Skip database initialization'
    )
    args = parser.parse_args()
    
    # Setup logging
    logger = setup_logging(args.verbose)
    
    logger.info("=" * 60)
    logger.info("VENTURESCOUT AI — DAILY CYCLE SCHEDULER")
    logger.info("=" * 60)
    logger.info(f"Start time: {datetime.utcnow().isoformat()}")
    
    # Check environment
    if not check_environment():
        logger.error("Environment check failed. Exiting.")
        sys.exit(1)
    
    # Initialize memory
    if not args.skip_init:
        try:
            logger.info("Initializing memory...")
            init_memory()
            logger.info("✅ Memory initialized")
        except Exception as e:
            logger.error(f"Failed to initialize memory: {e}")
            sys.exit(1)
    
    # Run the cycle
    try:
        logger.info("Starting daily cycle...")
        result = run_daily_cycle()
        
        # Log results
        logger.info("=" * 60)
        logger.info("DAILY CYCLE COMPLETE")
        logger.info("=" * 60)
        logger.info(f"  Candidates Found: {result.get('candidates_found', 0)}")
        logger.info(f"  Candidates Validated: {result.get('candidates_validated', 0)}")
        logger.info(f"  Candidates Escalated: {result.get('candidates_escalated', 0)}")
        logger.info(f"  Reports Generated: {len(result.get('reports', []))}")
        logger.info(f"  Errors: {len(result.get('errors', []))}")
        
        # Log reports summary
        if result.get('reports'):
            logger.info("\n  Generated Reports:")
            for i, report in enumerate(result['reports'], 1):
                company = report.get('company', 'Unknown')
                decision = report.get('decision', 'PASS')
                stars = report.get('star_rating', 0)
                logger.info(f"    {i}. {company}: {decision} (⭐{stars}/5)")
        
        # Log errors
        if result.get('errors'):
            logger.warning("\n  Errors encountered:")
            for error in result['errors']:
                logger.warning(f"    - {error[:200]}...")
        
        # Log completion
        logger.info(f"\nEnd time: {datetime.utcnow().isoformat()}")
        logger.info("=" * 60)
        
        # Return exit code
        if result.get('errors'):
            sys.exit(1)
        else:
            sys.exit(0)
            
    except KeyboardInterrupt:
        logger.info("Cycle interrupted by user")
        sys.exit(130)
    except Exception as e:
        logger.error(f"Daily cycle failed with unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


# ============================================================================
# GITHUB ACTIONS ENTRY POINT
# ============================================================================

def github_actions_main():
    """
    Special entry point for GitHub Actions.
    """
    # Set up logging to GitHub Actions format
    logging.basicConfig(
        level=logging.INFO,
        format='::%(levelname)s:: %(message)s'
    )
    logger = logging.getLogger(__name__)
    
    logger.info("Running VentureScout AI daily cycle on GitHub Actions")
    
    try:
        result = run_daily_cycle()
        
        # Output summary to GitHub Actions
        print("::group::Cycle Summary")
        print(f"Candidates Found: {result.get('candidates_found', 0)}")
        print(f"Candidates Validated: {result.get('candidates_validated', 0)}")
        print(f"Candidates Escalated: {result.get('candidates_escalated', 0)}")
        print(f"Reports Generated: {len(result.get('reports', []))}")
        print("::endgroup::")
        
        # Output reports
        if result.get('reports'):
            print("::group::Generated Reports")
            for i, report in enumerate(result['reports'], 1):
                company = report.get('company', 'Unknown')
                decision = report.get('decision', 'PASS')
                stars = report.get('star_rating', 0)
                score = report.get('weighted_score', 0)
                print(f"{i}. {company}: {decision} (⭐{stars}/5, Score: {score:.2f})")
            print("::endgroup::")
        
        # Set outputs for GitHub Actions
        if os.getenv('GITHUB_OUTPUT'):
            with open(os.getenv('GITHUB_OUTPUT'), 'a') as f:
                f.write(f"reports_count={len(result.get('reports', []))}\n")
                f.write(f"candidates_found={result.get('candidates_found', 0)}\n")
                f.write(f"errors_count={len(result.get('errors', []))}\n")
        
        # Return exit code
        if result.get('errors'):
            logger.error(f"Cycle completed with {len(result.get('errors', []))} errors")
            sys.exit(1)
        else:
            logger.info("Cycle completed successfully!")
            sys.exit(0)
            
    except Exception as e:
        logger.error(f"Cycle failed: {e}")
        sys.exit(1)


# ============================================================================
# DETECT ENVIRONMENT
# ============================================================================

if __name__ == "__main__":
    # Detect if running on GitHub Actions
    if os.getenv('GITHUB_ACTIONS') == 'true':
        github_actions_main()
    else:
        main()