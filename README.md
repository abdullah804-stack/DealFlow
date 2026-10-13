DealFlow
An analyst that never closes its terminal.

https://./docs/hero.png

What it is
DealFlow is an autonomous investment committee that discovers early-stage startups every day, filters them through a validation layer, and runs the strongest candidates through a five-agent committee that debates and votes — entirely without human intervention. It operates on a fixed daily schedule at 06:00 UTC, triaging the firehose of new launches from Hacker News, Reddit, RSS feeds, and the YC directory so that a human analyst can focus on the handful of deals that actually matter.

The core thesis is that the bottleneck in early-stage investing isn't judgment — it's attention. Thousands of founders launch something every 24 hours, and the signal is buried under an avalanche of noise that scrolls past before anyone serious reads it. Human analysts triage a fraction of that flow. DealFlow triages all of it, every single day, and produces a structured, versioned investment memo for every candidate that clears the bar.

What separates DealFlow from "just asking ChatGPT" is determinism and auditability. Five independent LLM personas — Technical, Finance, Marketing, Legal, and Founder — score each dossier against a locked, versioned rubric without seeing each other's initial scores. Voting is arithmetic code with fixed weights, never another LLM call. When specialists disagree, the disagreement is preserved in the report alongside rounds of reflection, so you can see exactly which agents changed their minds and why. And when the committee genuinely doesn't know, it says so: three or more critical unknowns triggers an INSUFFICIENT_EVIDENCE verdict rather than a forced score.

Live app
https://deal-flow-pearl.vercel.app

How it works
DealFlow runs as a three-stage pipeline:

01 — Discover. A scheduled Python process pulls fresh candidates from Hacker News, Reddit, startup RSS feeds, and the YC company directory. Each candidate is classified with an LLM pass and deduplicated by canonical domain.

02 — Evaluate. The five-agent committee scores the dossier independently — each specialist has its own system prompt, mandate, and scoring criteria — then reflects. Voting is deterministic code, never an LLM call.

03 — Decide. Weighted scoring produces INVEST, PASS, or INSUFFICIENT_EVIDENCE. Every result is stored with full disagreement history and a versioned rubric.

https://./docs/pipeline.png

Architecture
The system is built as two cooperating halves: a Next.js frontend deployed on Vercel that serves the dashboard, discovery feed, evaluation flow, and report viewer, and a Python pipeline that runs on a daily cron at 06:00 UTC to ingest, classify, and evaluate candidates.

Data flows in one direction. The pipeline writes reports, agent scores, disagreement history, and rubric versions into Postgres. The frontend reads from the same database through server components and API routes. The two halves never talk to each other directly — they share state through the database, which makes the pipeline independently testable and lets the UI stay read-only.

Inside the pipeline, the flow is linear: sources → classifier → deduplicator → ranker → committee → persistence. The committee is the only place where LLMs are called, and even there, the final verdict is decided by pure Python — not by the model. Each of the five specialist agents runs in isolation, produces a structured score object, reflects once, and writes its final score. A separate voting module consumes those five score objects and returns a verdict. No agent ever sees another agent's output.

https://./docs/architecture.png

Methodology
The rubric is locked and versioned. Every agent scores against the same criteria, but each one is weighted differently in the final tally:

Agent	Weight	Focus
Technical	25%	Architecture, scalability, technical moat
Finance	25%	Unit economics, TAM, path to revenue
Marketing	20%	Demand, positioning, GTM without burning cash
Founder	20%	Execution speed, team composition, delivery
Legal	10%	Compliance exposure, IP, data handling obligations
Scores from all five agents are combined by a deterministic voting function. The same five inputs always produce the same verdict — regardless of run order, concurrency, or re-runs. This is what makes DealFlow auditable: you can re-run any historical report against a new rubric version and diff the outcomes.

Final decision thresholds:

Verdict	Condition
INVEST	Weighted score ≥ 5.0 and fewer than 3 critical unknowns
PASS	Weighted score < 4.4
INSUFFICIENT_EVIDENCE	3+ critical unknowns flagged by any agents, or score between 4.4 and 5.0
The rubric is versioned (v1.0 → v2.0 → v2.3). Old reports are frozen against the rubric version they were scored with — they are never silently re-scored.

https://./docs/methodology.png

Scheduled jobs
The pipeline runs once per day at 06:00 UTC. The main job is a chain of sub-tasks:

Time (UTC)	Task	Duration
06:00	Ingest sources (HN, Reddit, RSS, YC)	~15 min
06:15	Classify and deduplicate candidates	~20 min
06:35	Rank candidates, select top 3	~10 min
06:45	Committee evaluation × 3 candidates	~4 hr 45 min
11:30	Persist reports and disagreement history	~25 min
11:55	Emit dashboard update	~5 min
Individual source refresh cadences run independently of the main job:

Hacker News — polled hourly

Reddit — polled hourly

RSS feeds — polled every 15 minutes

YC directory — refreshed daily, before the main job

https://./docs/scheduled-jobs.png

Screenshots
Dashboard — Today's Pick
https://./docs/dashboard.png

Discover Feed — Every candidate from the daily pipeline
https://./docs/discover.png

Committee Evaluation — Five specialists, one vote
https://./docs/committee.png

Evaluation Report — Full investment memo
https://./docs/report.png

Specialist Deep Dive — Technical Agent in action
https://./docs/specialist.png

The committee
Five specialists, one vote. Each agent has a distinct mandate and a fixed weight. The rubric is locked — same weights, same thresholds, every run.

Agent	Role	Weight	Mandate
Aris Bahri	Technical Agent	25%	Former infrastructure lead. Evaluates architecture, scalability, and whether the technical moat holds up under competitive pressure.
Amara Okafor	Finance Agent	25%	Ex-growth equity analyst. Tests unit economics, TAM sizing, and the path from current revenue to a real business.
Rohan Mehta	Marketing Agent	20%	Operating CMO background. Asks whether anyone actually wants this, and how the company reaches them without burning cash.
Mei Tanaka	Legal Agent	10%	Regulatory and IP counsel. Surfaces compliance exposure, data handling obligations, and structural risk before it becomes a problem.
Karim Haddad	Founder Agent	20%	Two prior exits. Judges execution speed, team composition, and whether the founders can ship what they've promised.
Tech stack
Layer	Technology
Frontend	Next.js (App Router), React, Tailwind CSS
Deployment	Vercel
Pipeline / Committee	Python
LLM orchestration	Multi-agent personas with per-agent system prompts
Voting engine	Deterministic weighted scoring (pure code)
Data sources	Hacker News, Reddit, RSS feeds, YC directory
Storage	Postgres (reports, disagreement history, rubric versions)
Scheduling	Cron — daily run at 06:00 UTC
Quick start (local dev)
Prerequisites: Node.js 18+, Python 3.11+, a Postgres instance, and API keys for your LLM provider.

bash
# 1. Clone the repo
git clone https://github.com/abdullah804-stack/deal-flow.git
cd deal-flow

# 2. Install frontend dependencies
npm install

# 3. Create and activate a Python virtualenv
python -m venv .venv && source .venv/bin/activate

# 4. Install pipeline dependencies
pip install -r requirements.txt

# 5. Configure environment
cp .env.example .env
# Fill in DATABASE_URL, LLM_API_KEY, and source credentials

# 6. Run database migrations
npm run db:migrate

# 7. Start the dev server
npm run dev
The app will be available at http://localhost:3000. To trigger a pipeline run manually, use python -m pipeline.run --once.

Tests
bash
# TypeScript / frontend tests
npm test

# Python pipeline and committee tests
pytest

# Parity checks — verifies deterministic voting matches expected
# outputs across rubric versions and score permutations
pytest tests/test_parity.py
Parity checks are the most important suite: they guarantee that the same set of agent scores always produces the same verdict, independent of ordering or run count.

What DealFlow is not
Not investment advice. Every prediction, score, and check size is an LLM-generated estimate — not a calibrated statistical forecast. Nothing here should inform an actual investment decision.

Not a chatbot wrapper. Voting is deterministic code with a locked rubric, not another LLM call. Scores can shift on re-run because the underlying models are non-deterministic, but the weights and thresholds never do.

Not exhaustive coverage. Sources are limited to Hacker News, Reddit, RSS, and the YC directory. Product Hunt, AngelList, and GitHub Trending are excluded — none offer reliable free access at scale.

Not a substitute for diligence. The committee output is a first-pass memo. Treat it as a structured opinion, not a verdict.

Not trained on your data. Submitted ideas stay on your account and are never used for model training or shared beyond the infrastructure providers in the privacy policy.

Repository layout
text
deal-flow/
├── app/                  # Next.js routes and UI
│   ├── dashboard/        # Overview and today's pick
│   ├── discover/         # Daily pipeline candidates feed
│   ├── evaluate/         # Committee evaluation flow
│   ├── reports/          # Generated investment memos
│   └── settings/         # User and pipeline configuration
├── components/           # React components (committee cards, memos)
├── lib/                  # Shared TS utilities, API clients
├── pipeline/             # Python discovery + committee orchestration
│   ├── sources/          # HN, Reddit, RSS, YC adapters
│   ├── agents/           # Five specialist personas and prompts
│   └── voting/           # Deterministic weighted scoring engine
├── tests/                # Pytest + parity checks
├── docs/                 # All README and documentation images
├── public/               # Static assets
└── README.md
License
Private. All rights reserved.