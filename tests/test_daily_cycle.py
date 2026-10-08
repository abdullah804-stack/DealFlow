"""
Phase 2 gate test — verifies the Postgres memory layer works end-to-end
without needing real LLM calls.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv()

import pytest
from src.memory import (
    add_seen_candidate,
    is_already_seen,
    save_dossier,
    save_decision,
    get_recent_reports,
    get_funnel_stats,
)
from src.memory.structured_memory import get_db


TEST_KEY = "phase-2-gate-test.example"
TEST_URL = f"https://{TEST_KEY}"


@pytest.fixture(autouse=True)
def cleanup():
    _delete()
    yield
    _delete()


def _delete():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                'DELETE FROM candidates WHERE "canonicalKey" = %s',
                (TEST_KEY,),
            )


def test_candidate_insert_and_dedup():
    assert is_already_seen(TEST_URL) is False
    cid = add_seen_candidate("Phase 2 Gate Test", TEST_URL, "test", 8.0)
    assert cid is not None
    assert is_already_seen(TEST_URL) is True

    cid2 = add_seen_candidate("Phase 2 Gate Test", TEST_URL, "test", 8.0)
    assert cid2 is None


def test_full_chain_candidate_dossier_decision():
    cid = add_seen_candidate("Gate Co", TEST_URL, "test", 7.0)
    assert cid is not None

    did = save_dossier(cid, {
        "company": "Gate Co",
        "industry": "Testing",
        "summary": "test",
        "technology": "pytest",
        "competitors": [],
        "funding_status": "unknown",
        "pricing_model": "unknown",
    })
    assert did is not None

    dec_id = save_decision(did, "INVEST", 7.5)
    assert dec_id is not None

    reports = get_recent_reports(limit=10)
    matching = [r for r in reports if r.get("title") == "Gate Co"]
    assert len(matching) >= 1
    assert matching[0]["decision"] == "INVEST"


def test_funnel_stats_counts():
    stats = get_funnel_stats(days_back=7)
    assert "discovered" in stats
    assert "validated" in stats
    assert "escalated" in stats
    assert "invested" in stats
    assert isinstance(stats["discovered"], int)