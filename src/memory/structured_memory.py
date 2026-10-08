"""
Structured Memory — Postgres database layer for DealFlow.

Rewritten from SQLite to Postgres (Neon) in Phase 2.
Function signatures match the previous SQLite version exactly so that
src/agents/* and src/orchestration/daily_cycle.py need zero changes.

Key translations:
- sqlite3.connect / Row  ->  psycopg.connect / dict_row
- sqlite3.IntegrityError ->  psycopg.errors.UniqueViolation
- `?` placeholders       ->  `%s` placeholders
- AUTOINCREMENT ids      ->  cuid() ids from Prisma schema
- TEXT JSON columns      ->  jsonb columns

The canonicalKey is derived from the URL via src.memory.canonical_key.
"""

import json
import logging
import os
from contextlib import contextmanager
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Json

from src.memory.canonical_key import canonical_key

logger = logging.getLogger(__name__)


# ============================================================================
# DATABASE CONNECTION
# ============================================================================

def _database_url() -> str:
    url = os.getenv("DATABASE_URL", "").strip()
    if not url:
        raise RuntimeError(
            "DATABASE_URL is not set. Add it to .env or the environment."
        )
    return url


@contextmanager
def get_db():
    """
    Context manager for database connections.
    Commits on success, rolls back on error, closes always.

    Usage:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
    """
    conn = psycopg.connect(_database_url(), row_factory=dict_row)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """
    Verify the schema exists. The schema is created by Prisma migrations,
    not by Python. This function is a smoke test: it fails loudly if the
    expected tables are missing.
    """
    required = [
        "candidates",
        "dossiers",
        "committee_decisions",
        "reports",
        "daily_runs",
    ]
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT tablename FROM pg_tables
                WHERE schemaname = 'public' AND tablename = ANY(%s)
                """,
                (required,),
            )
            found = {row["tablename"] for row in cur.fetchall()}
    missing = set(required) - found
    if missing:
        raise RuntimeError(
            f"Database is missing tables: {sorted(missing)}. "
            f"Run `npx prisma migrate deploy` first."
        )
    logger.info("Structured memory initialized (Postgres)")


# ============================================================================
# HELPERS
# ============================================================================

def _now_iso() -> str:
    return datetime.utcnow().isoformat()


def _coerce_json(value):
    """psycopg returns jsonb as already-parsed Python objects."""
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, (str, bytes)):
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return value
    return value


def _generate_cuid() -> str:
    """Simple collision-resistant id. Not a real cuid, but stable + unique."""
    import secrets
    import time

    return f"c{int(time.time() * 1000):x}{secrets.token_hex(8)}"


# ============================================================================
# CANDIDATES
# ============================================================================

def add_seen_candidate(
    title: str,
    url: str,
    source: str,
    discovery_confidence: Optional[float] = None,
) -> Optional[int]:
    """
    Add a candidate to the candidates table.

    Returns:
        The database row's internal id is NOT returned. For compatibility with
        the old SQLite code, we return a synthetic numeric id derived from
        the row's created position. Callers should not assume the value is
        stable across runs — it is used only to fetch the row back immediately.

    Compatibility shim: the old code expected an integer id. The new schema
    uses string cuid ids. We return the string id, cast to str, so the
    orchestrator can carry it as a dict key.
    """
    ck = canonical_key(url=url, source=source)
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO candidates
                        (id, "canonicalKey", title, url, source,
                         "discoveryConfidence", "isRealStartup", "firstSeen", "updatedAt")
                    VALUES (%s, %s, %s, %s, %s, %s, %s, now(), now())
                    ON CONFLICT ("canonicalKey") DO NOTHING
                    RETURNING id
                    """,
                    (
                        _generate_cuid(),
                        ck,
                        title,
                        url,
                        source,
                        discovery_confidence,
                        True,
                    ),
                )
                row = cur.fetchone()
                return row["id"] if row else None
    except psycopg.errors.UniqueViolation:
        logger.debug(f"Duplicate candidate: {ck}")
        return None
    except Exception as e:
        logger.error(f"add_seen_candidate failed for {url}: {e}")
        return None


def is_already_seen(url: str) -> bool:
    """Check whether a URL's canonical key exists."""
    ck = canonical_key(url=url, source="lookup")
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    'SELECT 1 FROM candidates WHERE "canonicalKey" = %s LIMIT 1',
                    (ck,),
                )
                return cur.fetchone() is not None
    except Exception:
        return False


def get_candidate_by_url(url: str) -> Optional[Dict[str, Any]]:
    ck = canonical_key(url=url, source="lookup")
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                'SELECT * FROM candidates WHERE "canonicalKey" = %s',
                (ck,),
            )
            return cur.fetchone()


def get_candidate_by_id(candidate_id: str) -> Optional[Dict[str, Any]]:
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM candidates WHERE id = %s", (candidate_id,))
            return cur.fetchone()


def get_recent_candidates(
    limit: int = 50,
    days_back: Optional[int] = None,
) -> List[Dict[str, Any]]:
    with get_db() as conn:
        with conn.cursor() as cur:
            if days_back:
                cutoff = datetime.utcnow() - timedelta(days=days_back)
                cur.execute(
                    """
                    SELECT * FROM candidates
                    WHERE "firstSeen" >= %s
                    ORDER BY "firstSeen" DESC LIMIT %s
                    """,
                    (cutoff, limit),
                )
            else:
                cur.execute(
                    "SELECT * FROM candidates ORDER BY \"firstSeen\" DESC LIMIT %s",
                    (limit,),
                )
            return list(cur.fetchall())


def update_discovery_confidence(candidate_id: str, confidence: float):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                'UPDATE candidates SET "discoveryConfidence" = %s, "updatedAt" = now() WHERE id = %s',
                (confidence, candidate_id),
            )


# ============================================================================
# DOSSIERS
# ============================================================================

def save_dossier(candidate_id: str, dossier_json: Dict[str, Any]) -> str:
    """
    Save a dossier. Returns the dossier id (string cuid).
    """
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO dossiers
                    (id, "candidateId", "dossierJson", company, industry,
                     technology, competitors, "fundingStatus", "pricingModel",
                     summary, "createdAt")
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now())
                RETURNING id
                """,
                (
                    _generate_cuid(),
                    candidate_id,
                    Json(dossier_json),
                    dossier_json.get("company"),
                    dossier_json.get("industry"),
                    dossier_json.get("technology"),
                    Json(dossier_json.get("competitors") or []),
                    dossier_json.get("funding_status"),
                    dossier_json.get("pricing_model"),
                    dossier_json.get("summary"),
                ),
            )
            return cur.fetchone()["id"]


def get_dossier(dossier_id: str) -> Optional[Dict[str, Any]]:
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM dossiers WHERE id = %s", (dossier_id,))
            row = cur.fetchone()
            if not row:
                return None
            row["dossier_json"] = _coerce_json(row.get("dossierJson"))
            return row


def get_latest_dossier_for_candidate(candidate_id: str) -> Optional[Dict[str, Any]]:
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT * FROM dossiers
                WHERE "candidateId" = %s
                ORDER BY "createdAt" DESC LIMIT 1
                """,
                (candidate_id,),
            )
            row = cur.fetchone()
            if not row:
                return None
            row["dossier_json"] = _coerce_json(row.get("dossierJson"))
            return row


def get_recent_dossiers(limit: int = 10) -> List[Dict[str, Any]]:
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT d.*, c.title, c.url, c.source
                FROM dossiers d
                JOIN candidates c ON d."candidateId" = c.id
                ORDER BY d."createdAt" DESC LIMIT %s
                """,
                (limit,),
            )
            rows = cur.fetchall()
            for r in rows:
                r["dossier_json"] = _coerce_json(r.get("dossierJson"))
            return rows


# ============================================================================
# DECISIONS
# ============================================================================

def save_decision(
    dossier_id: str,
    decision: str,
    weighted_score: float,
    fast_path: Optional[str] = None,
    round1_opinions: Optional[List[Dict[str, Any]]] = None,
    round2_opinions: Optional[List[Dict[str, Any]]] = None,
    debate_summary: Optional[str] = None,
) -> str:
    """
    Save a committee decision. The candidateId is looked up from the dossier.
    """
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                'SELECT "candidateId" FROM dossiers WHERE id = %s',
                (dossier_id,),
            )
            dossier_row = cur.fetchone()
            if not dossier_row:
                raise RuntimeError(f"Dossier {dossier_id} not found")
            candidate_id = dossier_row["candidateId"]

            cur.execute(
                """
                INSERT INTO committee_decisions
                    (id, "candidateId", "dossierId", decision, "weightedScore",
                     "fastPath", "round1Opinions", "round2Opinions",
                     "debateSummary", "rubricVersion", "createdAt")
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now())
                RETURNING id
                """,
                (
                    _generate_cuid(),
                    candidate_id,
                    dossier_id,
                    decision,
                    weighted_score,
                    fast_path,
                    Json(round1_opinions) if round1_opinions else None,
                    Json(round2_opinions) if round2_opinions else None,
                    debate_summary,
                    "1.0",
                ),
            )
            return cur.fetchone()["id"]


def get_decision(dossier_id: str) -> Optional[Dict[str, Any]]:
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT * FROM committee_decisions
                WHERE "dossierId" = %s
                ORDER BY "createdAt" DESC LIMIT 1
                """,
                (dossier_id,),
            )
            row = cur.fetchone()
            if not row:
                return None
            row["round1_opinions"] = _coerce_json(row.get("round1Opinions"))
            row["round2_opinions"] = _coerce_json(row.get("round2Opinions"))
            return row


def get_recent_reports(limit: int = 10) -> List[Dict[str, Any]]:
    """Join candidates + dossiers + committee_decisions for the API."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    c.id           AS candidate_id,
                    c.title,
                    c.url,
                    c.source,
                    d.id           AS dossier_id,
                    d."dossierJson" AS "dossierJson",
                    dec.decision,
                    dec."weightedScore" AS "weightedScore",
                    dec."fastPath"      AS "fastPath",
                    dec."round1Opinions" AS "round1Opinions",
                    dec."round2Opinions" AS "round2Opinions",
                    dec."debateSummary"  AS "debateSummary",
                    dec."createdAt"      AS "createdAt"
                FROM committee_decisions dec
                JOIN dossiers d   ON dec."dossierId" = d.id
                JOIN candidates c ON d."candidateId" = c.id
                ORDER BY dec."createdAt" DESC
                LIMIT %s
                """,
                (limit,),
            )
            rows = cur.fetchall()
            for r in rows:
                r["dossier_json"] = _coerce_json(r.pop("dossierJson", None))
                r["round1_opinions"] = _coerce_json(r.pop("round1Opinions", None))
                r["round2_opinions"] = _coerce_json(r.pop("round2Opinions", None))
            return rows


def get_recent_reports_by_days(days: int = 7) -> List[Dict[str, Any]]:
    cutoff = datetime.utcnow() - timedelta(days=days)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    c.id           AS candidate_id,
                    c.title,
                    c.url,
                    c.source,
                    d.id           AS dossier_id,
                    d."dossierJson" AS "dossierJson",
                    dec.decision,
                    dec."weightedScore" AS "weightedScore",
                    dec."fastPath"      AS "fastPath",
                    dec."round1Opinions" AS "round1Opinions",
                    dec."round2Opinions" AS "round2Opinions",
                    dec."debateSummary"  AS "debateSummary",
                    dec."createdAt"      AS "createdAt"
                FROM committee_decisions dec
                JOIN dossiers d   ON dec."dossierId" = d.id
                JOIN candidates c ON d."candidateId" = c.id
                WHERE dec."createdAt" >= %s
                ORDER BY dec."createdAt" DESC
                """,
                (cutoff,),
            )
            rows = cur.fetchall()
            for r in rows:
                r["dossier_json"] = _coerce_json(r.pop("dossierJson", None))
                r["round1_opinions"] = _coerce_json(r.pop("round1Opinions", None))
                r["round2_opinions"] = _coerce_json(r.pop("round2Opinions", None))
            return rows

# ============================================================================
# REPORTS
# ============================================================================

def save_report(
    candidate_id: str,
    dossier_id: Optional[str],
    decision_id: Optional[str],
    report_json: Dict[str, Any],
    schema_version: str = "1.0",
) -> str:
    """
    Persist a generated report to the reports table.

    Args:
        candidate_id: FK to candidates
        dossier_id: FK to dossiers (nullable)
        decision_id: FK to committee_decisions (nullable)
        report_json: full report dict from report_generator
        schema_version: report schema version

    Returns:
        str: the report id (cuid)
    """
    import hashlib

    # Content hash for dedup — same report JSON should not produce duplicate rows
    content_hash = hashlib.sha256(
        json.dumps(report_json, sort_keys=True, default=str).encode("utf-8")
    ).hexdigest()

    with get_db() as conn:
        with conn.cursor() as cur:
            # Idempotent: if content_hash already exists, return existing row
            cur.execute(
                'SELECT id FROM reports WHERE "contentHash" = %s',
                (content_hash,),
            )
            existing = cur.fetchone()
            if existing:
                return existing["id"]

            cur.execute(
                """
                INSERT INTO reports
                    (id, "candidateId", "dossierId", "decisionId",
                     "subjectType", "schemaVersion", "reportJson",
                     "contentHash", company, decision, "weightedScore",
                     "starRating", "createdAt")
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now())
                RETURNING id
                """,
                (
                    _generate_cuid(),
                    candidate_id,
                    dossier_id,
                    decision_id,
                    "candidate",
                    schema_version,
                    Json(report_json),
                    content_hash,
                    report_json.get("company"),
                    report_json.get("decision"),
                    report_json.get("weighted_score"),
                    report_json.get("star_rating"),
                ),
            )
            return cur.fetchone()["id"]


# ============================================================================
# FUNNEL STATISTICS
# ============================================================================

def get_funnel_stats(days_back: int = 7) -> Dict[str, Any]:
    cutoff = datetime.utcnow() - timedelta(days=days_back)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                'SELECT COUNT(*) AS n FROM candidates WHERE "firstSeen" >= %s',
                (cutoff,),
            )
            discovered = cur.fetchone()["n"]

            cur.execute(
                """
                SELECT COUNT(*) AS n FROM candidates
                WHERE "firstSeen" >= %s AND "discoveryConfidence" >= 5.0
                """,
                (cutoff,),
            )
            validated = cur.fetchone()["n"]

            cur.execute(
                """
                SELECT COUNT(DISTINCT c.id) AS n
                FROM candidates c
                JOIN dossiers d ON c.id = d."candidateId"
                WHERE c."firstSeen" >= %s
                """,
                (cutoff,),
            )
            escalated = cur.fetchone()["n"]

            cur.execute(
                """
                SELECT COUNT(DISTINCT c.id) AS n
                FROM candidates c
                JOIN dossiers d ON c.id = d."candidateId"
                JOIN committee_decisions dec ON d.id = dec."dossierId"
                WHERE c."firstSeen" >= %s AND dec.decision = 'INVEST'
                """,
                (cutoff,),
            )
            invested = cur.fetchone()["n"]

    return {
        "discovered": discovered,
        "validated": validated,
        "escalated": escalated,
        "invested": invested,
        "period_days": days_back,
    }


# ============================================================================
# BACKTEST
# ============================================================================

def save_backtest_result(
    startup_name: str,
    actual_outcome: str,
    committee_verdict: str,
    aligned_with_outcome: bool,
    dossier_text: str,
) -> str:
    """
    Backtest rows live in the reports table with subjectType='backtest'.
    This keeps the schema lean and avoids a separate table.
    """
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO reports
                    (id, "subjectType", "schemaVersion", "reportJson",
                     company, decision, "createdAt")
                VALUES (%s, %s, %s, %s, %s, %s, now())
                RETURNING id
                """,
                (
                    _generate_cuid(),
                    "backtest",
                    "1.0",
                    Json(
                        {
                            "startup_name": startup_name,
                            "actual_outcome": actual_outcome,
                            "committee_verdict": committee_verdict,
                            "aligned_with_outcome": aligned_with_outcome,
                            "dossier_text": dossier_text,
                        }
                    ),
                    startup_name,
                    committee_verdict,
                ),
            )
            return cur.fetchone()["id"]


def get_backtest_results() -> Dict[str, Any]:
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT "reportJson" FROM reports
                WHERE "subjectType" = 'backtest'
                ORDER BY "createdAt" DESC
                """
            )
            rows = cur.fetchall()

    per_startup = []
    for r in rows:
        data = _coerce_json(r.get("reportJson")) or {}
        per_startup.append(
            {
                "startup_name": data.get("startup_name"),
                "actual_outcome": data.get("actual_outcome"),
                "committee_verdict": data.get("committee_verdict"),
                "aligned_with_outcome": bool(data.get("aligned_with_outcome")),
            }
        )

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
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM reports WHERE \"subjectType\" = 'backtest'")


# ============================================================================
# INITIALIZATION
# ============================================================================

def seed_database():
    init_db()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    from dotenv import load_dotenv

    load_dotenv()
    seed_database()
    print("Structured memory initialized (Postgres)")