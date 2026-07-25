# VentureScout AI — Autonomous VC Analyst

Every 24 hours, unprompted: a Discovery Agent pulls fresh candidates from
free sources (Hacker News, Reddit, tech RSS feeds), a Validation Agent
dedupes and scores them, the top 3 (locked cap) get a full dossier and go
to an Investment Committee (5 investor agents, reused from the Boardroom
project's architecture) who debate, reflect, and vote. A Report
Generator produces a VC-memo-style report for each. A historical
backtest module demonstrates whether the committee's judgment tracks
real outcomes, using curated past startups with known results (a
buildable substitute for "wait 6 months and see").

## Status
Scope locked. See PROJECT_OUTLINE.md.

## Quick start
1. python -m venv venv && source venv/bin/activate
2. pip install -r requirements.txt
3. Copy .env.example to .env — free Groq + OpenRouter keys (no others needed)
4. python scripts/seed_backtest_startups.py
5. python -m src.scheduler.run_cycle     (runs one full daily cycle)
6. python -m src.evaluation.backtest     (runs the historical backtest)
7. Frontend: see frontend/README.md

## Tech stack (100% free)
- LLM (primary): Groq free tier | (fallback): OpenRouter free tier
  (Groq primary — this project's daily call volume is the highest of any
  version discussed; verify your real usage against Groq's limits)
- Discovery sources: Hacker News official API (free, no key), Reddit
  public JSON endpoints (free), tech RSS feeds (free) — Product Hunt,
  AngelList, GitHub Trending, and IndieHackers are deliberately NOT used
  in v1: no accessible free API for reliable use
- Structured memory: SQLite | Vector memory: ChromaDB (local)
- Orchestration: plain Python, fixed linear flow
- Backend: FastAPI | Frontend: Next.js + Tailwind
- Autonomy: GitHub Actions cron (daily) | Deploy: Render + Vercel (free)
