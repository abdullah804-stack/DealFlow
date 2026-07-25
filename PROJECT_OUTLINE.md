# PROJECT OUTLINE — VentureScout AI (Autonomous VC Analyst)
### LOCKED SPEC — FINAL v1.

---

## 0. What this is, what it solves, what you get

**What it is:** Every 24 hours, unprompted, a Discovery Agent pulls fresh
startup candidates from free sources, a Validation Agent narrows and
ranks them, the top 3 (locked cap) get a real dossier and go before a
5-investor Investment Committee that debates, reflects, and votes, and a
Report Generator produces a VC-memo-style investment report for each.

**What problem it solves:** the actual problem stated in the brief —
"we're continuously looking for new startups, but no human can analyze
all of them." This system triages a wide, noisy stream of candidates
down to the few worth real analytical attention, autonomously, on its
own schedule.

**What's honestly different from the original brief, and why:**
- **Sources locked to Hacker News + Reddit + RSS feeds** — Product Hunt,
  AngelList, GitHub Trending, and IndieHackers don't have reliable free
  APIs; building on them would mean building on sand.
- **Full committee treatment capped at 3 candidates/day** — running 18
  candidates through a full 5-investor debate would cost 150+ LLM calls
  daily, well past any free tier. The rest of the day's shortlist still
  gets logged with a validation score, just not a full report.
- **"Learning from real outcomes 6 months later" replaced with a
  historical backtest** — the live version needs real elapsed time a
  portfolio build doesn't have. The backtest (curated past startups with
  known outcomes, evaluated using only period-appropriate information)
  demonstrates the same mechanism and produces a real result now.
- **Reflection is round 2 of the debate, not a third round** — keeps the
  bounded-debate design from the committee's original version intact.

**What you get, concretely:**
1. Daily VC-memo-style reports for up to 3 candidates
2. A discovery funnel view — how many candidates found → validated →
   escalated, visible even for candidates that didn't get a full report
3. A backtest scorecard — real accuracy number against curated
   historical cases, reported honestly as a demonstration, not a
   statistically rigorous evaluation
4. A chat interface over the system's own memory

---

## 1. Component roster (locked)

| Component | Type | Job |
|---|---|---|
| Discovery Agent | LLM, batched | Classifies raw pulled candidates: real startup worth investigating? |
| Validation Agent | Code + LLM (batched) | Dedupes, ranks, narrows to shortlist, selects top 3 for full committee |
| Dossier Builder | LLM, 1 call/candidate (max 3/day) | Structures available info into a research dossier |
| 5 Investor Agents | LLM (reused from Boardroom architecture) | Technical/Finance/Marketing/Legal/Founder, same goals and weights |
| Moderator Agent | LLM (light) | Runs round 1, checks fast-path, runs round 2 if needed, summarizes |
| Voting | Code, NOT LLM | Deterministic weighted scorecard |
| Report Generator | LLM, 1 call/candidate | VC-memo-style report assembly + executive synthesis |
| Backtest module | Reuses committee pipeline | Historical accuracy demonstration |

**Real daily LLM call volume estimate:** Discovery (~3-5 batched calls)
+ Validation (~1-2 batched calls) + up to 3 × (Dossier 1 + Committee
~6-16 depending on fast-path + Report 1) ≈ **40-70 calls/day**. This is
why Groq is primary, and why the daily cap exists at all — verify your
real number in Phase 6, don't just trust this estimate.

---

## 2. Tech stack (100% free)

| Layer | Choice | Notes |
|---|---|---|
| LLM (primary) | Groq free tier | Highest call volume of any version discussed |
| LLM (fallback) | OpenRouter free tier | |
| Discovery sources | Hacker News API, Reddit public JSON, RSS feeds | All free, no keys |
| Structured memory | SQLite | Candidates, dossiers, decisions, backtest results |
| Vector memory | ChromaDB + sentence-transformers | Local, free |
| Orchestration | Plain Python | Fixed pipeline, no framework |
| Backend | FastAPI | |
| Frontend | Next.js + Tailwind | 4 views |
| Autonomy | GitHub Actions cron (daily) | Free |
| Deployment | Render + Vercel | Free tiers |

---

## 3. Locked configuration

```python
REDDIT_SUBREDDITS = ["startups", "SideProject", "Entrepreneur"]
RSS_FEEDS = ["https://techcrunch.com/category/startups/feed/", ...]

VALIDATION_SHORTLIST_MAX = 10
MAX_CANDIDATES_FULL_COMMITTEE_PER_DAY = 3
DISCOVERY_BATCH_SIZE = 10

INVESTOR_WEIGHTS = {"technical":0.25,"finance":0.25,"marketing":0.20,"legal":0.10,"founder":0.20}
DEBATE_ROUNDS = 2
INVESTMENT_THRESHOLD = 6.5
FAST_PATH_CONSENSUS_HIGH = 8.5
FAST_PATH_CONSENSUS_LOW = 3.0

RUN_INTERVAL_HOURS = 24
LLM_PROVIDER_PRIMARY = "groq"
LLM_PROVIDER_FALLBACK = "openrouter"
```

---

## 4. Repository structure

```
venturescout-ai/
├── README.md / PROJECT_OUTLINE.md
├── requirements.txt / .env.example / .gitignore
├── config/settings.py
├── src/
│   ├── llm/client.py
│   ├── sources/hackernews_source.py, reddit_source.py, rss_source.py
│   ├── agents/
│   │   ├── discovery_agent.py, validation_agent.py, dossier_builder.py
│   │   ├── investor_agent.py       ← port from boardroom-ai if you built it
│   │   ├── moderator_agent.py      ← + fast-path logic
│   │   ├── voting.py
│   │   └── report_generator.py
│   ├── memory/structured_memory.py, vector_memory.py
│   ├── orchestration/daily_cycle.py
│   ├── scheduler/run_cycle.py
│   ├── evaluation/backtest.py, scorecard.py
│   └── api/main.py
├── frontend/                       ← 4 views incl. discovery funnel + backtest
├── tests/  (test_sources, test_agents)
├── scripts/seed_backtest_startups.py   ← requires real research/writing by you
└── .github/workflows/scheduled_run.yml (daily cron)
```

---

## 5. Build order (locked)

### Phase 1 — Sources + LLM client
**DoD:** All 3 free sources return real data. LLM client falls back
correctly on a forced Groq error.

### Phase 2 — Discovery + Validation agents
**DoD:** `classify_batch()` returns correct-count JSON arrays.
`select_for_full_committee()` never returns more than
MAX_CANDIDATES_FULL_COMMITTEE_PER_DAY regardless of input size — test
this explicitly with a fake oversized ranked list.

### Phase 3 — Investor agents + voting, standalone
Port from Boardroom if you have it; otherwise build fresh, same shape.
**DoD:** One persona produces valid structured opinions against one real dossier.

### Phase 4 — Memory + RAG wiring
**DoD:** Dedup check (`is_already_seen`) correctly prevents re-analyzing
a candidate seen in a prior run.

### Phase 5 — Moderator + fast-path + Dossier Builder
**DoD:** `check_fast_path()` correctly triggers auto-approve/auto-reject
on hand-crafted unanimous cases and correctly returns None on mixed
scores. Dossier Builder marks unknown fields as "unknown," never fabricates.

### Phase 6 — Orchestration + Report Generator + Scheduler
**DoD:** One full daily cycle runs end-to-end, respects the daily cap,
survives a simulated failure on one candidate, and you've printed +
verified the real LLM call count broken down by stage.

### Phase 7 — API + Frontend
**DoD:** All 4 views render real data, including candidates that didn't
make the full-committee cut (discovery funnel).

### Phase 8 — Backtest + Evaluation
Requires real research: hand-write 8-10 historical dossiers with known
outcomes, being careful not to leak outcome info into the "early" dossier text.
**DoD:** Backtest runs, produces a real accuracy number, reported with
honest caveats about sample size.

### Phase 9 — Deploy
**DoD:** Runs unattended for 48+ hours (2 daily cycles minimum), provable
via GitHub Actions history.

---

## 6. Deliverables

| # | Deliverable | Phase |
|---|---|---|
| 1 | Live dashboard with daily reports + funnel + backtest | 9 |
| 2 | 48-hour+ unattended autonomy proof | 9 |
| 3 | A real example of the fast-path skipping debate on a unanimous case | 6 |
| 4 | A real example of full round-2 reflection changing an investor's score | 6 |
| 5 | Backtest accuracy result with honest sample-size caveat | 8 |
| 6 | Discovery funnel stats over 1-2 weeks (found → validated → escalated) | 9 |
| 7 | Architecture diagram covering the full pipeline | 5 |
| 8 | 90-second demo: a real daily report walkthrough + the backtest result | 7 |

---

## 7. Non-negotiables

- Sources locked to Hacker News + Reddit + RSS. No Product Hunt/
  AngelList/GitHub Trending/IndieHackers in v1 — no reliable free access.
- MAX_CANDIDATES_FULL_COMMITTEE_PER_DAY = 3, enforced in code, not
  trusted to any agent's judgment.
- Reflection = round 2. No third debate round.
- Backtest dossiers must not contain outcome-leaking information — this
  is a correctness requirement, not a style preference.
- No LangGraph — fixed pipeline, plain function chain.
- No live "learns from outcomes 6 months later" claim anywhere in the
  portfolio writeup — the honest claim is the backtest demonstrates the
  mechanism; don't overstate it as live learning that hasn't happened.
- This is the final locked project.
