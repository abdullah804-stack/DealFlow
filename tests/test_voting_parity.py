"""
Voting parity test — ensures TS and Python voting produce identical output.

This test is a marker: it prints its result in a canonical format that the
CI job compares against the TS side. See .github/workflows/ci.yml.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.agents.voting import aggregate_scores


CASES = [
    {
        "name": "mixed",
        "opinions": [
            {"persona": "technical", "name": "Technical VC", "score": 8.0},
            {"persona": "finance", "name": "Finance VC", "score": 7.0},
            {"persona": "marketing", "name": "Marketing VC", "score": 6.5},
            {"persona": "legal", "name": "Legal VC", "score": 5.5},
            {"persona": "founder", "name": "Serial Founder", "score": 7.5},
        ],
    },
    {
        "name": "unanimous_high",
        "opinions": [
            {"persona": "technical", "name": "Technical VC", "score": 9.0},
            {"persona": "finance", "name": "Finance VC", "score": 9.0},
            {"persona": "marketing", "name": "Marketing VC", "score": 9.0},
            {"persona": "legal", "name": "Legal VC", "score": 9.0},
            {"persona": "founder", "name": "Serial Founder", "score": 9.0},
        ],
    },
    {
        "name": "unanimous_low",
        "opinions": [
            {"persona": "technical", "name": "Technical VC", "score": 2.0},
            {"persona": "finance", "name": "Finance VC", "score": 2.0},
            {"persona": "marketing", "name": "Marketing VC", "score": 2.0},
            {"persona": "legal", "name": "Legal VC", "score": 2.0},
            {"persona": "founder", "name": "Serial Founder", "score": 2.0},
        ],
    },
]


def main() -> None:
    results = []
    for case in CASES:
        r = aggregate_scores(case["opinions"])
        results.append(
            {
                "name": case["name"],
                "weightedTotal": round(float(r["weighted_total"]), 4),
                "decision": r["decision"],
                "fastPath": r["fast_path"],
            }
        )
    print("VOTING_PARITY_JSON_START")
    print(json.dumps(results, sort_keys=True, indent=2))
    print("VOTING_PARITY_JSON_END")


if __name__ == "__main__":
    main()