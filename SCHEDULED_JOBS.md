\# Scheduled Jobs — Python ↔ Postgres Contract



This document is the contract between the Python discovery pipeline and the

Next.js application. \*\*Any Prisma migration that touches a table listed below

must be reviewed by the Python side before commit.\*\*



Failing to do this means the Python pipeline reads a stale schema and writes

to columns that no longer exist — silently, without error.



\---



\## Tables Python writes to



Every table in this list is written by `src/scheduler/run\_cycle.py` (via

`src/memory/structured\_memory.py`). Any schema change to these tables requires:



1\. A Prisma migration in `prisma/migrations/`

2\. Manual review by the Python side before `git commit`

3\. Verification that `src/memory/structured\_memory.py` and

&#x20;  `src/memory/memory\_integration.py` still match the new schema



| Table | Written by | Purpose |

|---|---|---|

| `DailyRun` | `daily\_cycle.py` | One row per daily cycle execution |

| `Candidate` | `discovery\_agent.py` | Every discovered candidate (deduped by `canonicalKey`) |

| `Dossier` | `daily\_cycle.py` | Structured dossier for committee candidates |

| `Evidence` | `daily\_cycle.py` | Source evidence rows (candidate-only) |

| `AgentAssessment` | `daily\_cycle.py` | Per-agent scores (candidate-only) |

| `CommitteeDecision` | `daily\_cycle.py` | Final weighted decision (candidate-only) |

| `Report` | `daily\_cycle.py` | Generated report JSON (discovery reports only) |

| `AgentRunLog` | `daily\_cycle.py` | Per-LLM-call log rows for cost tracking |



\---



\## Tables Python does NOT touch



Managed exclusively by Next.js / Auth.js:



\- `User`

\- `Account`

\- `Session`

\- `VerificationToken`

\- `IdeaEvaluation` (added in Phase 5)

\- `InterviewSession` (added in Phase 5)

\- `InterviewTurn` (added in Phase 5)

\- `AuditLog` (added in Phase 8)

\- `CostLog` (added in Phase 8)



Changes to these tables do not require Python-side review.



\---



\## Migration boundary rules



1\. \*\*Additive changes only\*\* — new tables, new nullable columns. Python never

&#x20;  has to change for these.

2\. \*\*No renames without Python-side review\*\* — renaming a column breaks

&#x20;  `structured\_memory.py` silently.

3\. \*\*No drops without Python-side review\*\* — same reason.

4\. \*\*No type changes\*\* — changing `String` to `Int` on a column Python writes

&#x20;  will fail at runtime with a psycopg type error.



When in doubt: \*\*ask before you commit.\*\*



\---



\## When this document gets updated



\- Any time a new table is added to the Python pipeline

\- Any time a column on an existing Python table is renamed or retyped

\- Any time a Python table is removed



Update this file in the same commit as the schema change.

