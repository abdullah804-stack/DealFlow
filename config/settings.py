# config/settings.py
"""
DealFlow — Configuration Constants
Single source of truth for all settings.
All values locked per docs/legacy/PROJECT_OUTLINE.md and docs/legacy/VENTURESCOUT_MASTER_SPEC.md.
"""

import os
from pathlib import Path

# ============================================================================
# PATHS
# ============================================================================

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

SQLITE_PATH = DATA_DIR / "memory.db"
CHROMA_PATH = str(DATA_DIR / "chroma_db")

# ============================================================================
# DISCOVERY SOURCES
# ============================================================================

# Reddit subreddits to monitor
REDDIT_SUBREDDITS = ["startups", "SideProject", "Entrepreneur"]

# RSS feeds to monitor
RSS_FEEDS = [
    "https://techcrunch.com/category/startups/feed/",
    # Add more working feeds here as needed
]

# ============================================================================
# PIPELINE CAPS — These make the free LLM budget work, do not change
# ============================================================================

VALIDATION_SHORTLIST_MAX = 10              # Max candidates in shortlist
MAX_CANDIDATES_FULL_COMMITTEE_PER_DAY = 3  # LOCKED: Top N get full committee treatment
DISCOVERY_BATCH_SIZE = 10                  # Batch size for LLM classification calls

# ============================================================================
# INVESTMENT COMMITTEE
# ============================================================================

# Weighted scoring for each investor persona (must sum to 1.0)
INVESTOR_WEIGHTS = {
    "technical": 0.25,
    "finance": 0.25,
    "marketing": 0.20,
    "legal": 0.10,
    "founder": 0.20,
}

DEBATE_ROUNDS = 2                  # Round 2 = reflection round (not a 3rd round)
INVESTMENT_THRESHOLD = 6.5         # Weighted score >= this => "INVEST"
FAST_PATH_CONSENSUS_HIGH = 8.5     # All investors >= this in round 1 => auto-approve
FAST_PATH_CONSENSUS_LOW = 3.0      # All investors <= this in round 1 => auto-reject

# ============================================================================
# LLM PROVIDER CONFIGURATION
# ============================================================================

LLM_PROVIDER_PRIMARY = "groq"
LLM_PROVIDER_FALLBACK = "openrouter"

# Groq
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = "llama-3.3-70b-versatile"
GROQ_BASE_URL = "https://api.groq.com/openai/v1"

# OpenRouter (fallback)
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL = "meta-llama/llama-3.3-70b-instruct:free"
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

# LLM temperature and max tokens
LLM_TEMPERATURE = 0.7
LLM_MAX_TOKENS = 2048

# ============================================================================
# SCHEDULING
# ============================================================================

RUN_INTERVAL_HOURS = 24  # Daily cycle

# ============================================================================
# API
# ============================================================================

API_HOST = "0.0.0.0"
API_PORT = 8000
CORS_ORIGINS = [
    "http://localhost:3000",   # Next.js dev
    "https://your-vercel-domain.vercel.app",  # Production (update on deploy)
]

# ============================================================================
# BACKTEST
# ============================================================================

BACKTEST_SEED_FILE = BASE_DIR / "scripts" / "seed_backtest_startups.py"

# ============================================================================
# LOGGING
# ============================================================================

LOG_LEVEL = "INFO"

# ============================================================================
# VALIDATION: Ensure critical configs are set
# ============================================================================

def validate_config():
    """Raise errors if critical configuration is missing."""
    if not GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY environment variable is not set.")
    if not OPENROUTER_API_KEY:
        raise ValueError("OPENROUTER_API_KEY environment variable is not set.")
    
    # Ensure weights sum to 1.0
    total_weight = sum(INVESTOR_WEIGHTS.values())
    if abs(total_weight - 1.0) > 0.001:
        raise ValueError(f"INVESTOR_WEIGHTS must sum to 1.0. Current: {total_weight}")
    
    # Ensure daily cap is respected
    if MAX_CANDIDATES_FULL_COMMITTEE_PER_DAY > 3:
        raise ValueError(
            f"MAX_CANDIDATES_FULL_COMMITTEE_PER_DAY cannot exceed 3. "
            f"Current: {MAX_CANDIDATES_FULL_COMMITTEE_PER_DAY}"
        )

# ============================================================================
# AUTO-VALIDATE ON IMPORT (optional, can be commented out for production)
# ============================================================================

# Uncomment to validate on import:
# validate_config()