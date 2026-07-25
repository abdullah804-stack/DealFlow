# src/memory/structured_memory.py
"""
Structured Memory — SQLite database layer for VentureScout AI.

Provides persistent storage for:
- seen_candidates: All discovered candidates with deduplication
- dossiers: Full research dossiers for candidates that made the cut
- decisions: Committee voting results
- backtest_results: Historical accuracy demonstration

All operations use context managers for safe connection handling.
"""

import json
import sqlite3
import logging
from contextlib import contextmanager
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Tuple

from config.settings import SQLITE_PATH

logger = logging.getLogger(__name__)


# ============================================================================
# SCHEMA DEFINITION
# ============================================================================

SCHEMA = """
-- Track all candidates ever discovered (for deduplication)
CREATE TABLE IF NOT EXISTS seen_candidates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    url TEXT UNIQUE NOT NULL,          -- UNIQUE constraint for deduplication
    source TEXT NOT NULL,              -- 'hackernews' | 'reddit' | rss feed url
    first_seen TEXT NOT NULL,          -- ISO timestamp
    discovery_confidence REAL          -- Score from Discovery Agent (0-10)
);

-- Full dossiers for candidates that reached the committee
CREATE TABLE IF NOT EXISTS dossiers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    candidate_id INTEGER NOT NULL,
    dossier_json TEXT NOT NULL,        -- Full structured dossier as JSON
    timestamp TEXT NOT NULL,           -- ISO timestamp
    FOREIGN KEY (candidate_id) REFERENCES seen_candidates(id)
);

-- Committee decisions for each dossier
CREATE TABLE IF NOT EXISTS decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dossier_id INTEGER NOT NULL,
    decision TEXT NOT NULL,            -- 'INVEST' | 'PASS'
    weighted_score REAL NOT NULL,      -- Final weighted score (0-10)
    fast_path TEXT,                    -- 'auto_approve' | 'auto_reject' | NULL
    round1_opinions TEXT,              -- JSON of round 1 investor opinions
    round2_opinions TEXT,              -- JSON of round 2 investor opinions (or NULL)
    debate_summary TEXT,               -- Moderator's debate summary
    timestamp TEXT NOT NULL,           -- ISO timestamp
    FOREIGN KEY (dossier_id) REFERENCES dossiers(id)
);

-- Historical backtest results
CREATE TABLE IF NOT EXISTS backtest_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    startup_name TEXT NOT NULL,
    actual_outcome TEXT NOT NULL,      -- 'succeeded' | 'failed' | 'acquired'
    committee_verdict TEXT NOT NULL,   -- 'INVEST' | 'PASS'
    aligned_with_outcome BOOLEAN NOT NULL,
    dossier_text TEXT,                 -- The dossier as presented to committee (no outcome info)
    timestamp TEXT NOT NULL            -- ISO timestamp
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_seen_candidates_url ON seen_candidates(url);
CREATE INDEX IF NOT EXISTS idx_seen_candidates_first_seen ON seen_candidates(first_seen);
CREATE INDEX IF NOT EXISTS idx_dossiers_candidate_id ON dossiers(candidate_id);
CREATE INDEX IF NOT EXISTS idx_dossiers_timestamp ON dossiers(timestamp);
CREATE INDEX IF NOT EXISTS idx_decisions_dossier_id ON decisions(dossier_id);
CREATE INDEX IF NOT EXISTS idx_decisions_timestamp ON decisions(timestamp);
"""


# ============================================================================
# DATABASE CONNECTION
# ============================================================================

@contextmanager
def get_db():
    """
    Context manager for database connections.
    Automatically commits on success, rolls back on error.
    
    Usage:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM seen_candidates")
    """
    conn = sqlite3.connect(SQLITE_PATH)
    conn.row_factory = sqlite3.Row  # Access columns by name
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """Initialize the database schema. Called once at startup."""
    with get_db() as conn:
        conn.executescript(SCHEMA)
    logger.info(f"Database initialized at {SQLITE_PATH}")


# ============================================================================
# SEEN CANDIDATES OPERATIONS
# ============================================================================

def add_seen_candidate(
    title: str,
    url: str,
    source: str,
    discovery_confidence: Optional[float] = None,
) -> Optional[int]:
    """
    Add a candidate to the seen_candidates table.
    
    Returns:
        int: Candidate ID if inserted
        None: If duplicate (URL already exists)
    """
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO seen_candidates (title, url, source, first_seen, discovery_confidence)
                VALUES (?, ?, ?, ?, ?)
                """,
                (title, url, source, datetime.utcnow().isoformat(), discovery_confidence)
            )
            return cursor.lastrowid
    except sqlite3.IntegrityError:
        # URL already exists (duplicate)
        logger.debug(f"Duplicate candidate: {url}")
        return None


def is_already_seen(url: str) -> bool:
    """Check if a URL has been seen before."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT 1 FROM seen_candidates WHERE url = ?", (url,))
        return cursor.fetchone() is not None


def get_candidate_by_url(url: str) -> Optional[Dict[str, Any]]:
    """Get a candidate by URL."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM seen_candidates WHERE url = ?", (url,))
        row = cursor.fetchone()
        return dict(row) if row else None


def get_candidate_by_id(candidate_id: int) -> Optional[Dict[str, Any]]:
    """Get a candidate by ID."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM seen_candidates WHERE id = ?", (candidate_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def get_recent_candidates(
    limit: int = 50,
    days_back: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """Get recently discovered candidates."""
    with get_db() as conn:
        cursor = conn.cursor()
        query = "SELECT * FROM seen_candidates"
        params = []
        
        if days_back:
            cutoff = (datetime.utcnow() - timedelta(days=days_back)).isoformat()
            query += " WHERE first_seen >= ?"
            params.append(cutoff)
        
        query += " ORDER BY first_seen DESC LIMIT ?"
        params.append(limit)
        
        cursor.execute(query, params)
        return [dict(row) for row in cursor.fetchall()]


def update_discovery_confidence(candidate_id: int, confidence: float):
    """Update a candidate's discovery confidence."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE seen_candidates SET discovery_confidence = ? WHERE id = ?",
            (confidence, candidate_id)
        )


# ============================================================================
# DOSSIER OPERATIONS
# ============================================================================

def save_dossier(candidate_id: int, dossier_json: Dict[str, Any]) -> int:
    """
    Save a dossier to the database.
    
    Returns:
        int: Dossier ID
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO dossiers (candidate_id, dossier_json, timestamp)
            VALUES (?, ?, ?)
            """,
            (candidate_id, json.dumps(dossier_json), datetime.utcnow().isoformat())
        )
        return cursor.lastrowid


def get_dossier(dossier_id: int) -> Optional[Dict[str, Any]]:
    """Get a dossier by ID."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM dossiers WHERE id = ?", (dossier_id,))
        row = cursor.fetchone()
        if row:
            result = dict(row)
            result["dossier_json"] = json.loads(result["dossier_json"])
            return result
        return None


def get_latest_dossier_for_candidate(candidate_id: int) -> Optional[Dict[str, Any]]:
    """Get the most recent dossier for a candidate."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT * FROM dossiers
            WHERE candidate_id = ?
            ORDER BY timestamp DESC LIMIT 1
            """,
            (candidate_id,)
        )
        row = cursor.fetchone()
        if row:
            result = dict(row)
            result["dossier_json"] = json.loads(result["dossier_json"])
            return result
        return None


def get_recent_dossiers(limit: int = 10) -> List[Dict[str, Any]]:
    """Get the most recent dossiers."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT d.*, s.title, s.url, s.source
            FROM dossiers d
            JOIN seen_candidates s ON d.candidate_id = s.id
            ORDER BY d.timestamp DESC LIMIT ?
            """,
            (limit,)
        )
        rows = cursor.fetchall()
        result = []
        for row in rows:
            row_dict = dict(row)
            row_dict["dossier_json"] = json.loads(row_dict["dossier_json"])
            result.append(row_dict)
        return result


# ============================================================================
# DECISION OPERATIONS
# ============================================================================

def save_decision(
    dossier_id: int,
    decision: str,
    weighted_score: float,
    fast_path: Optional[str] = None,
    round1_opinions: Optional[List[Dict[str, Any]]] = None,
    round2_opinions: Optional[List[Dict[str, Any]]] = None,
    debate_summary: Optional[str] = None,
) -> int:
    """
    Save a committee decision.
    
    Args:
        decision: 'INVEST' or 'PASS'
        weighted_score: Final weighted score (0-10)
        fast_path: 'auto_approve', 'auto_reject', or None
        round1_opinions: List of round 1 investor opinions
        round2_opinions: List of round 2 investor opinions (or None)
        debate_summary: Moderator's summary
    
    Returns:
        int: Decision ID
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO decisions (
                dossier_id, decision, weighted_score, fast_path,
                round1_opinions, round2_opinions, debate_summary, timestamp
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                dossier_id,
                decision,
                weighted_score,
                fast_path,
                json.dumps(round1_opinions) if round1_opinions else None,
                json.dumps(round2_opinions) if round2_opinions else None,
                debate_summary,
                datetime.utcnow().isoformat()
            )
        )
        return cursor.lastrowid


def get_decision(dossier_id: int) -> Optional[Dict[str, Any]]:
    """Get the decision for a dossier."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT * FROM decisions
            WHERE dossier_id = ?
            ORDER BY timestamp DESC LIMIT 1
            """,
            (dossier_id,)
        )
        row = cursor.fetchone()
        if row:
            result = dict(row)
            result["round1_opinions"] = json.loads(result["round1_opinions"]) if result["round1_opinions"] else None
            result["round2_opinions"] = json.loads(result["round2_opinions"]) if result["round2_opinions"] else None
            return result
        return None


def get_recent_reports(limit: int = 10) -> List[Dict[str, Any]]:
    """
    Get recent reports with full data for the API.
    Joins seen_candidates, dossiers, and decisions.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT 
                s.id as candidate_id,
                s.title,
                s.url,
                s.source,
                d.id as dossier_id,
                d.dossier_json,
                dec.decision,
                dec.weighted_score,
                dec.fast_path,
                dec.round1_opinions,
                dec.round2_opinions,
                dec.debate_summary,
                dec.timestamp
            FROM decisions dec
            JOIN dossiers d ON dec.dossier_id = d.id
            JOIN seen_candidates s ON d.candidate_id = s.id
            ORDER BY dec.timestamp DESC
            LIMIT ?
            """,
            (limit,)
        )
        rows = cursor.fetchall()
        result = []
        for row in rows:
            row_dict = dict(row)
            row_dict["dossier_json"] = json.loads(row_dict["dossier_json"])
            row_dict["round1_opinions"] = json.loads(row_dict["round1_opinions"]) if row_dict["round1_opinions"] else None
            row_dict["round2_opinions"] = json.loads(row_dict["round2_opinions"]) if row_dict["round2_opinions"] else None
            result.append(row_dict)
        return result


def get_recent_reports_by_days(days: int = 7) -> List[Dict[str, Any]]:
    """Get reports from the last N days."""
    cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT 
                s.id as candidate_id,
                s.title,
                s.url,
                s.source,
                d.id as dossier_id,
                d.dossier_json,
                dec.decision,
                dec.weighted_score,
                dec.fast_path,
                dec.round1_opinions,
                dec.round2_opinions,
                dec.debate_summary,
                dec.timestamp
            FROM decisions dec
            JOIN dossiers d ON dec.dossier_id = d.id
            JOIN seen_candidates s ON d.candidate_id = s.id
            WHERE dec.timestamp >= ?
            ORDER BY dec.timestamp DESC
            """,
            (cutoff,)
        )
        rows = cursor.fetchall()
        result = []
        for row in rows:
            row_dict = dict(row)
            row_dict["dossier_json"] = json.loads(row_dict["dossier_json"])
            row_dict["round1_opinions"] = json.loads(row_dict["round1_opinions"]) if row_dict["round1_opinions"] else None
            row_dict["round2_opinions"] = json.loads(row_dict["round2_opinions"]) if row_dict["round2_opinions"] else None
            result.append(row_dict)
        return result


# ============================================================================
# FUNNEL STATISTICS
# ============================================================================

def get_funnel_stats(days_back: int = 7) -> Dict[str, Any]:
    """
    Calculate discovery funnel statistics for the API.
    
    Returns:
        {
            "discovered": int,      # Total candidates discovered
            "validated": int,       # Candidates that made it to shortlist
            "escalated": int,       # Candidates that got full committee treatment
            "invested": int,        # Candidates that received "INVEST" decision
            "period_days": int      # Period covered
        }
    """
    cutoff = (datetime.utcnow() - timedelta(days=days_back)).isoformat()
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Discovered: all candidates in the period
        cursor.execute(
            "SELECT COUNT(*) FROM seen_candidates WHERE first_seen >= ?",
            (cutoff,)
        )
        discovered = cursor.fetchone()[0]
        
        # Validated: candidates with discovery_confidence >= 5.0 (threshold for shortlist)
        cursor.execute(
            """
            SELECT COUNT(*) FROM seen_candidates 
            WHERE first_seen >= ? AND discovery_confidence >= 5.0
            """,
            (cutoff,)
        )
        validated = cursor.fetchone()[0]
        
        # Escalated: candidates with dossiers (full committee)
        cursor.execute(
            """
            SELECT COUNT(DISTINCT s.id)
            FROM seen_candidates s
            JOIN dossiers d ON s.id = d.candidate_id
            WHERE s.first_seen >= ?
            """,
            (cutoff,)
        )
        escalated = cursor.fetchone()[0]
        
        # Invested: candidates with "INVEST" decision
        cursor.execute(
            """
            SELECT COUNT(DISTINCT s.id)
            FROM seen_candidates s
            JOIN dossiers d ON s.id = d.candidate_id
            JOIN decisions dec ON d.id = dec.dossier_id
            WHERE s.first_seen >= ? AND dec.decision = 'INVEST'
            """,
            (cutoff,)
        )
        invested = cursor.fetchone()[0]
        
        return {
            "discovered": discovered,
            "validated": validated,
            "escalated": escalated,
            "invested": invested,
            "period_days": days_back,
        }


# ============================================================================
# BACKTEST OPERATIONS
# ============================================================================

def save_backtest_result(
    startup_name: str,
    actual_outcome: str,
    committee_verdict: str,
    aligned_with_outcome: bool,
    dossier_text: str,
) -> int:
    """Save a backtest result."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO backtest_results (
                startup_name, actual_outcome, committee_verdict,
                aligned_with_outcome, dossier_text, timestamp
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                startup_name,
                actual_outcome,
                committee_verdict,
                1 if aligned_with_outcome else 0,
                dossier_text,
                datetime.utcnow().isoformat()
            )
        )
        return cursor.lastrowid


def get_backtest_results() -> Dict[str, Any]:
    """
    Get backtest results for the API.
    
    Returns:
        {
            "total": int,
            "aligned": int,
            "accuracy_pct": float,
            "per_startup": [
                {"startup_name": "...", "actual_outcome": "...", ...}
            ]
        }
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT startup_name, actual_outcome, committee_verdict, aligned_with_outcome
            FROM backtest_results
            ORDER BY timestamp DESC
            """
        )
        rows = cursor.fetchall()
        
        per_startup = []
        for row in rows:
            per_startup.append({
                "startup_name": row["startup_name"],
                "actual_outcome": row["actual_outcome"],
                "committee_verdict": row["committee_verdict"],
                "aligned_with_outcome": bool(row["aligned_with_outcome"]),
            })
        
        total = len(per_startup)
        aligned = sum(1 for r in per_startup if r["aligned_with_outcome"])
        accuracy_pct = (aligned / total * 100) if total > 0 else 0.0
        
        return {
            "total": total,
            "aligned": aligned,
            "accuracy_pct": accuracy_pct,
            "per_startup": per_startup,
        }


def clear_backtest_results():
    """Clear all backtest results (for re-seeding)."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM backtest_results")


# ============================================================================
# INITIALIZATION
# ============================================================================

def seed_database():
    """Initialize the database schema."""
    init_db()


if __name__ == "__main__":
    # Quick test
    logging.basicConfig(level=logging.INFO)
    seed_database()
    print(f"✅ Database initialized at {SQLITE_PATH}")
    
    # Test adding a candidate
    candidate_id = add_seen_candidate(
        title="Test Startup",
        url="https://test.com",
        source="test",
        discovery_confidence=7.5
    )
    print(f"✅ Added test candidate with ID: {candidate_id}")