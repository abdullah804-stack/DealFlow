# Frontend — Next.js + Tailwind (Phase 7)

npx create-next-app@latest frontend --typescript --tailwind --app

## Views (locked — 4)
1. **Daily reports** — the full VC-memo-style reports for that day's
   up-to-3 fully-analyzed candidates.
2. **Discovery funnel** — how many candidates found -> validated ->
   escalated to committee, even for the ones that didn't get a full
   report. This makes the Discovery/Validation agents' work visible,
   not just the committee's.
3. **Backtest results** — the historical accuracy demonstration.
4. **Chat** — ask the system about its own history.

## Deployment
Vercel free tier. NEXT_PUBLIC_API_URL -> Render-hosted backend.
