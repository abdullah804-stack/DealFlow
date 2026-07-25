# VENTURESCOUT AI — MASTER SPECIFICATION
### Single source of truth. Locked. Hand this document to any AI coding tool to build the project without further context.

---

## 1. PROJECT SUMMARY

**Name:** VentureScout AI — Autonomous VC Analyst

**What it does:** Every 24 hours, unprompted, the system pulls fresh startup
candidates from free sources, filters and ranks them, selects the top 3,
builds a research dossier for each, runs them through a 5-agent Investment
Committee that debates and votes, and generates a VC-memo-style report.
Fully autonomous — no user interaction required to run a cycle.

**Problem it solves:** Too many startups appear daily for a human to
manually track and evaluate. This system triages a wide, noisy candidate
stream down to a small number worth real analytical attention, continuously.

**What it explicitly does NOT do:** Execute trades, place real investments,
or integrate with any brokerage/payment system. It is a research and
recommendation system only. This is a permanent boundary, not a v1 gap.

**Primary outputs:**
1. Daily VC-memo-style investment reports (up to 3/day)
2. A discovery funnel dashboard (found → validated → escalated)
3. A historical backtest scorecard (committee judgment vs. known real outcomes)
4. A chat interface over the system's own memory

---

## 2. COMPLETE TECH STACK

| Layer | Choice | Package/Service | Cost |
|---|---|---|---|
| LLM (primary) | Groq — `llama-3.3-70b-versatile` | `groq` python SDK | Free tier |
| LLM (fallback) | OpenRouter — `meta-llama/llama-3.3-70b-instruct:free` | `openai` SDK, `base_url="https://openrouter.ai/api/v1"` | Free tier |
| Discovery: Hacker News | Official Firebase API | `requests` | Free, no key |
| Discovery: Reddit | Public JSON endpoints | `requests` | Free, no key (custom User-Agent required) |
| Discovery: News/blogs | RSS feeds | `feedparser` | Free, no key |
| Structured memory | SQLite | Python stdlib `sqlite3` | Free |
| Vector memory | ChromaDB | `chromadb` | Free, local |
| Embeddings | sentence-transformers `all-MiniLM-L6-v2` | `sentence-transformers` | Free, local, no API |
| Orchestration | Plain Python function chain | — | Free (see Section 9 for LangGraph-optional note) |
| Backend | FastAPI | `fastapi`, `uvicorn` | Free |
| Frontend | Next.js + Tailwind CSS | `create-next-app` | Free |
| Local scheduling (dev) | APScheduler | `apscheduler` | Free |
| Cloud scheduling (prod) | GitHub Actions cron | — | Free (public repo minutes) |
| Backend hosting | Render free tier | — | Free |
| Frontend hosting | Vercel free tier | — | Free |

**Accounts required (all free, no card):** Groq, OpenRouter. Nothing else needs signup.

**requirements.txt (exact, locked):**
```
groq
openai
fastapi
uvicorn
python-dotenv
pydantic
requests
feedparser
chromadb
sentence-transformers
apscheduler
```

**Environment variables (.env):**
```
GROQ_API_KEY=
OPENROUTER_API_KEY=
```

---

## 3. LOCKED CONFIGURATION (config/settings.py — exact values)

```python
# Discovery sources
REDDIT_SUBREDDITS = ["startups", "SideProject", "Entrepreneur"]
RSS_FEEDS = ["https://techcrunch.com/category/startups/feed/"]  # add more real working feeds

# Pipeline caps — these make the free LLM budget work, do not remove
VALIDATION_SHORTLIST_MAX = 10
MAX_CANDIDATES_FULL_COMMITTEE_PER_DAY = 3
DISCOVERY_BATCH_SIZE = 10

# Investment Committee
INVESTOR_WEIGHTS = {
    "technical": 0.25, "finance": 0.25, "marketing": 0.20,
    "legal": 0.10, "founder": 0.20,
}
DEBATE_ROUNDS = 2                  # round 2 = reflection round, not a 3rd round
INVESTMENT_THRESHOLD = 6.5         # weighted score >= this => "INVEST"
FAST_PATH_CONSENSUS_HIGH = 8.5     # all investors >= this in round 1 => auto-approve, skip round 2
FAST_PATH_CONSENSUS_LOW = 3.0      # all investors <= this in round 1 => auto-reject, skip round 2

# Scheduling
RUN_INTERVAL_HOURS = 24

# LLM provider
LLM_PROVIDER_PRIMARY = "groq"
LLM_PROVIDER_FALLBACK = "openrouter"
GROQ_MODEL = "llama-3.3-70b-versatile"
OPENROUTER_MODEL = "meta-llama/llama-3.3-70b-instruct:free"

# Storage paths
SQLITE_PATH = "data/memory.db"
CHROMA_PATH = "data/chroma_db"
```

---

## 4. INVESTOR PERSONAS (locked, exact)

| Key | Name | Goal | Cares about | Tool | Weight |
|---|---|---|---|---|---|
| `technical` | Technical VC | Determine defensible technical moat | scalability, architecture, AI feasibility, competition | `estimate_infra_cost` | 0.25 |
| `finance` | Finance VC | Determine business model profitability | revenue, CAC, LTV, burn rate, TAM | `estimate_tam` | 0.25 |
| `marketing` | Marketing VC | Determine real market demand/differentiation | positioning, demand, differentiation | `competitor_search` | 0.20 |
| `legal` | Legal VC | Determine compliance/regulatory risk | privacy, GDPR, copyright, regulation | `compliance_checklist` | 0.10 |
| `founder` | Serial Founder | Determine execution feasibility | MVP scope, hiring, execution speed | `mvp_cost_estimator` | 0.20 |

---

## 5. COMPLETE FILE STRUCTURE (with purpose of every file)

```
venturescout-ai/
├── README.md                              — project overview, quick start
├── PROJECT_OUTLINE.md                     — narrative build-order doc (companion to this spec)
├── requirements.txt                       — exact deps, see Section 2
├── .env.example                           — GROQ_API_KEY, OPENROUTER_API_KEY
├── .gitignore
├── config/
│   └── settings.py                        — ALL locked constants, Section 3
├── src/
│   ├── llm/
│   │   └── client.py                      — call_llm(): Groq primary, OpenRouter fallback, normalized response
│   ├── sources/
│   │   ├── hackernews_source.py           — get_show_hn_posts() via HN Firebase API
│   │   ├── reddit_source.py               — get_recent_posts(subreddit) via Reddit public JSON
│   │   └── rss_source.py                  — get_recent_articles(feed_url), get_all_rss_candidates()
│   ├── agents/
│   │   ├── discovery_agent.py             — classify_batch(), run_discovery(): pulls all sources, dedupes, classifies
│   │   ├── validation_agent.py            — score_and_rank(), select_for_full_committee(): enforces daily cap
│   │   ├── dossier_builder.py             — build_dossier(): 1 LLM call/candidate, marks unknowns explicitly
│   │   ├── investor_agent.py              — InvestorAgent class: form_initial_opinion(), form_rebuttal()
│   │   ├── moderator_agent.py             — run_round_1(), check_fast_path(), run_round_2(), summarize_debate()
│   │   ├── voting.py                      — aggregate_scores(): pure math, NOT an LLM call
│   │   └── report_generator.py            — generate_report(), export_markdown()
│   ├── memory/
│   │   ├── structured_memory.py           — SQLite: schema + all read/write functions, see Section 6
│   │   └── vector_memory.py               — ChromaDB: add_memory(), query_memory()
│   ├── orchestration/
│   │   └── daily_cycle.py                 — run_daily_cycle(): the entire pipeline, one function
│   ├── scheduler/
│   │   └── run_cycle.py                   — entry point for local + GitHub Actions
│   ├── evaluation/
│   │   ├── backtest.py                    — run_backtest(): historical accuracy demonstration
│   │   └── scorecard.py                   — summarize_discovery_funnel()
│   └── api/
│       └── main.py                        — FastAPI app, see Section 7 for exact endpoint contracts
├── frontend/                              — Next.js + Tailwind, see Section 8 for views
│   └── README.md
├── tests/
│   ├── test_sources.py
│   └── test_agents.py
├── scripts/
│   └── seed_backtest_startups.py          — hand-curated 8-10 historical startups, REQUIRES real research
└── .github/workflows/
    └── scheduled_run.yml                  — daily cron, commits updated memory.db back to repo
```

---

## 6. DATA SCHEMAS (SQLite — exact CREATE TABLE statements)

```sql
CREATE TABLE IF NOT EXISTS seen_candidates (
    id INTEGER PRIMARY KEY,
    title TEXT,
    url TEXT,
    source TEXT,              -- 'hackernews' | 'reddit' | rss feed url
    first_seen TEXT,          -- ISO timestamp
    discovery_confidence REAL
);

CREATE TABLE IF NOT EXISTS dossiers (
    id INTEGER PRIMARY KEY,
    candidate_id INTEGER REFERENCES seen_candidates(id),
    dossier_json TEXT,        -- full structured dossier, see Section 9 for shape
    timestamp TEXT
);

CREATE TABLE IF NOT EXISTS decisions (
    id INTEGER PRIMARY KEY,
    dossier_id INTEGER REFERENCES dossiers(id),
    decision TEXT,            -- 'INVEST' | 'PASS'
    weighted_score REAL,
    fast_path TEXT,           -- 'auto_approve' | 'auto_reject' | NULL (went through full debate)
    timestamp TEXT
);

CREATE TABLE IF NOT EXISTS backtest_results (
    id INTEGER PRIMARY KEY,
    startup_name TEXT,
    actual_outcome TEXT,      -- 'succeeded' | 'failed' | 'acquired'
    committee_verdict TEXT,   -- 'INVEST' | 'PASS'
    aligned_with_outcome BOOLEAN,
    timestamp TEXT
);
```

ChromaDB collection: single collection, documents = text summaries of
dossiers/decisions, metadata = `{candidate_id, decision, timestamp}`.

---

## 7. API CONTRACTS (FastAPI — exact endpoints)

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/reports?days=7` | query param `days` (int) | `[{dossier, round1, round2 or null, fast_path, vote, report_markdown, timestamp}]` |
| GET | `/funnel` | none | `{discovered: int, validated: int, escalated: int, invested: int, period_days: int}` |
| GET | `/backtest` | none | `{total: int, aligned: int, accuracy_pct: float, per_startup: [...]}` |
| POST | `/chat` | `{"message": str}` | `{"response": str, "sources": [{candidate_id, timestamp}]}` |
| GET | `/health` | none | `{"status": "ok"}` |

CORS: enabled for the Next.js frontend origin (`localhost:3000` dev,
Vercel domain in prod).

---

## 8. FRONTEND — 4 LOCKED VIEWS (Next.js + Tailwind)

1. **Daily reports** — full VC-memo report per candidate (Exec Summary,
   Startup Overview, Competitive Landscape, Technology/Market/Financial/
   Legal Analysis, Founder Evaluation, Committee Debate, Final Recommendation)
2. **Discovery funnel** — found → validated → escalated → invested, including candidates that didn't reach full committee
3. **Backtest results** — accuracy number + per-startup breakdown, with sample-size caveat shown
4. **Chat** — free-text query against `/chat`

---

## 9. AGENT I/O CONTRACTS (exact structured JSON shapes)

**Discovery Agent — `classify_batch()` output (array, one per candidate):**
```json
{"title": "...", "is_real_startup": true, "reasoning": "...", "initial_confidence": 7}
```

**Validation Agent — refines confidence, same shape plus:**
```json
{"final_confidence": 8, "rank": 1}
```

**Dossier Builder — `build_dossier()` output:**
```json
{
  "company": "...", "industry": "...", "pricing_model": "...",
  "competitors": ["...", "..."], "estimated_users": "unknown",
  "technology": "...", "funding_status": "unknown", "summary": "..."
}
```
Rule: any field the source data doesn't support MUST be `"unknown"`, never fabricated.

**Investor Agent — `form_initial_opinion()` / `form_rebuttal()` output:**
```json
{"opinion": "...", "score": 7, "confidence": 8}
```

**Risk/contradiction checks:** N/A in this project (that pattern belongs
to the sibling RiskCouncil project) — VentureScout's equivalent
verification is the Moderator comparing investor claims during round 2.

**Voting — `aggregate_scores()` output:**
```json
{"weighted_total": 7.2, "decision": "INVEST", "per_investor": {"technical": 7, "finance": 6, ...}}
```

**Report Generator — final report includes:**
```json
{
  "star_rating": 4, "probability_of_success_pct": 72,
  "biggest_risk": "...", "biggest_advantage": "...",
  "recommended_check_size": "$250k", "recommended_stage": "Seed"
}
```
Note: star rating / probability / check size are LLM-generated estimates,
not calibrated statistical predictions — report template must state this explicitly.

---

## 10. LLM CALL BUDGET (per daily cycle, estimated)

| Stage | Calls |
|---|---|
| Discovery classification (batched) | ~3-5 |
| Validation scoring (batched) | ~1-2 |
| Dossier Builder (per full-committee candidate, max 3) | 1 × up to 3 = up to 3 |
| Committee round 1 (5 investors × up to 3 candidates) | up to 15 |
| Committee round 2 (only if no fast-path, 5 × up to 3) | 0-15 |
| Moderator debate summary (up to 3) | up to 3 |
| Report generation (up to 3) | up to 3 |
| **Total** | **~40-70/day** |

This is why Groq is primary — verify real usage in Phase 6 before assuming headroom.

---

## 11. BUILD PHASES (summary — see PROJECT_OUTLINE.md for full Definition-of-Done detail)

1. Sources + LLM client (standalone, zero agent dependency)
2. Discovery + Validation agents
3. Investor agents + voting, standalone
4. Memory + RAG wiring
5. Moderator (fast-path logic) + Dossier Builder
6. Orchestration (daily_cycle.py) + Report Generator + Scheduler
7. API + Frontend
8. Backtest + Evaluation
9. Deploy (GitHub Actions + Render + Vercel)

---

## 12. NON-NEGOTIABLES (do not change without a deliberate new spec version)

- Discovery sources locked to Hacker News + Reddit + RSS only
- `MAX_CANDIDATES_FULL_COMMITTEE_PER_DAY = 3`, enforced in code
- `DEBATE_ROUNDS = 2` — round 2 IS the reflection round, never a 3rd round
- Voting is deterministic code, never an LLM call
- Dossier unknowns are marked "unknown," never fabricated
- No brokerage/trade execution integration, ever
- No live "learns from real outcomes" claim — only the backtest, honestly labeled as a demonstration

---

## 13. APPENDIX — LangGraph (optional, not used in locked v1)

**Current design uses plain Python function calls, not LangGraph**, because
the control flow is a fixed pipeline with exactly one binary branch
(fast-path skip vs. full round 2) — a framework adds dependency and
debugging overhead with no functional benefit here.

**If you want the LangGraph experience anyway** (e.g., for framework
familiarity), it maps cleanly onto `src/orchestration/daily_cycle.py` only
— nothing else in the spec changes:

- **Nodes:** `discovery_node`, `validation_node`, `dossier_node` (loops
  per selected candidate), `round1_node`, `fast_path_check_node`,
  `round2_node`, `vote_node`, `report_node`
- **Conditional edge:** after `round1_node` → `fast_path_check_node` →
  routes to `vote_node` directly (fast path) or `round2_node` then `vote_node`
- **State object:** candidate, dossier, round1_opinions, round2_opinions
  (nullable), vote_result, report

This is a drop-in infrastructure swap, not a scope or behavior change —
every agent's I/O contract in Section 9 stays identical either way.
