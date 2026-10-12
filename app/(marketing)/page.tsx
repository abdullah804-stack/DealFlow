import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Reveal } from "@/components/Reveal";

export const dynamic = "force-dynamic";

async function getLiveStats() {
  try {
    const [candidates, reports, evaluations] = await Promise.all([
      prisma.candidate.count(),
      prisma.report.count({ where: { subjectType: "candidate" } }),
      prisma.ideaEvaluation.count(),
    ]);
    return { candidates, reports, evaluations };
  } catch {
    return { candidates: 0, reports: 0, evaluations: 0 };
  }
}

export default async function LandingPage() {
  const stats = await getLiveStats();

  return (
    <main className="relative z-10">
      <SiteNav />

      {/* ─── Hero ─────────────────────────────────────────────── */}
      <section className="relative px-8 py-24 md:py-32 overflow-hidden">
        {/* Radial glow behind hero */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 50% 0%, rgba(57,255,20,0.10), transparent 55%)",
          }}
        />
        <div className="max-w-5xl mx-auto relative">
          <Reveal>
            <div className="eyebrow text-center mb-6">
              Autonomous investment committee
            </div>
          </Reveal>
          <Reveal delay={100}>
            <h1 className="text-5xl md:text-6xl font-semibold text-center leading-[1.08] tracking-tight mb-6">
              An analyst that never
              <br />
              <span className="gradient-text-neon">closes its terminal.</span>
            </h1>
          </Reveal>
          <Reveal delay={200}>
            <p className="text-[var(--color-text-mid)] text-lg md:text-xl leading-relaxed max-w-2xl mx-auto text-center mb-10">
              DealFlow discovers new startups every day, filters them through
              a validation layer, and runs the strongest candidates through
              a five-agent investment committee that debates and votes —
              autonomously, at 06:00 UTC.
            </p>
          </Reveal>
          <Reveal delay={300}>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Link href="/signup" className="btn-primary">
                Start exploring
              </Link>
              <Link href="/sample" className="btn-ghost">
                See a sample report
              </Link>
            </div>
          </Reveal>

          {/* Live stats strip */}
          <Reveal delay={500}>
            <div className="mt-16 grid grid-cols-3 gap-6 max-w-2xl mx-auto">
              <StatBlock value={stats.candidates} label="Candidates discovered" />
              <StatBlock value={stats.reports} label="Reports generated" />
              <StatBlock value={stats.evaluations} label="Ideas evaluated" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── How it works ─────────────────────────────────────── */}
      <section className="px-8 py-20 border-t border-[var(--color-border-soft)]">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <div className="eyebrow mb-4">How it works</div>
              <h2 className="text-3xl md:text-4xl font-semibold">
                Three stages, one pipeline.
              </h2>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6">
            <Reveal delay={100}>
              <StageCard
                index="01"
                title="Discover"
                glyph="▽"
                body="Pulls fresh candidates from Hacker News, Reddit, and startup RSS feeds. Classifies each one with an LLM pass and deduplicates by canonical domain."
              />
            </Reveal>
            <Reveal delay={200}>
              <StageCard
                index="02"
                title="Evaluate"
                glyph="◈"
                body="The five-agent committee — Technical, Finance, Marketing, Legal, Founder — scores the dossier independently, then reflects. Voting is deterministic code, never an LLM call."
              />
            </Reveal>
            <Reveal delay={300}>
              <StageCard
                index="03"
                title="Decide"
                glyph="◆"
                body="Weighted scoring produces INVEST, PASS, or INSUFFICIENT_EVIDENCE. Every result is stored with full disagreement history and a versioned rubric."
              />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── Committee ────────────────────────────────────────── */}
      <section className="px-8 py-20 border-t border-[var(--color-border-soft)]">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <div className="eyebrow mb-4">The committee</div>
              <h2 className="text-3xl md:text-4xl font-semibold">
                Five specialists, one vote.
              </h2>
              <p className="text-[var(--color-text-mid)] mt-4 max-w-2xl mx-auto">
                Each agent has a distinct mandate and a fixed weight. The
                rubric is locked — same weights, same thresholds, every run.
              </p>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-5 gap-4">
            {[
              { name: "Technical", weight: "25%", focus: "Moat & feasibility", glyph: "◆" },
              { name: "Finance", weight: "25%", focus: "Unit economics", glyph: "◈" },
              { name: "Marketing", weight: "20%", focus: "Demand & positioning", glyph: "▽" },
              { name: "Legal", weight: "10%", focus: "Regulation & IP", glyph: "▲" },
              { name: "Founder", weight: "20%", focus: "Execution", glyph: "◇" },
            ].map((agent, i) => (
              <Reveal key={agent.name} delay={i * 80}>
                <div className="panel text-center h-full">
                  <div className="text-[var(--color-neon)] text-2xl mb-3">
                    {agent.glyph}
                  </div>
                  <div className="font-semibold mb-1">{agent.name}</div>
                  <div className="font-mono text-xs text-[var(--color-neon)] mb-3">
                    {agent.weight}
                  </div>
                  <div className="text-xs text-[var(--color-text-mid)] leading-relaxed">
                    {agent.focus}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Dual path ────────────────────────────────────────── */}
      <section className="px-8 py-20 border-t border-[var(--color-border-soft)]">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <div className="eyebrow mb-4">Two ways to use it</div>
              <h2 className="text-3xl md:text-4xl font-semibold">
                Watch the feed, or run your own idea.
              </h2>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-2 gap-6">
            <Reveal delay={100}>
              <div className="panel-lg h-full flex flex-col">
                <div className="text-[var(--color-neon)] text-3xl mb-4">▤</div>
                <h3 className="text-xl font-semibold mb-3">
                  Browse discovered startups
                </h3>
                <p className="text-sm text-[var(--color-text-mid)] leading-relaxed mb-6 flex-1">
                  Every 24 hours, a new batch of candidates flows through the
                  pipeline. See the funnel from discovery to committee
                  verdict, and read the full memo for each escalated
                  candidate.
                </p>
                <div className="flex items-center gap-3">
                  <Link href="/sample" className="btn-ghost text-sm">
                    View sample
                  </Link>
                  <Link href="/signup" className="text-[var(--color-neon)] text-sm hover:underline">
                    Sign up →
                  </Link>
                </div>
              </div>
            </Reveal>
            <Reveal delay={200}>
              <div className="panel-lg h-full flex flex-col">
                <div className="text-[var(--color-neon)] text-3xl mb-4">◇</div>
                <h3 className="text-xl font-semibold mb-3">
                  Evaluate your own idea
                </h3>
                <p className="text-sm text-[var(--color-text-mid)] leading-relaxed mb-6 flex-1">
                  Submit an idea. Answer up to 25 questions from the
                  committee. The same five specialists evaluate it against
                  the same rubric used for discovered candidates. You get a
                  full report.
                </p>
                <div className="flex items-center gap-3">
                  <Link href="/signup" className="btn-primary text-sm">
                    Submit an idea
                  </Link>
                  <Link href="/methodology" className="text-[var(--color-text-mid)] text-sm hover:text-[var(--color-neon)]">
                    Read rubric →
                  </Link>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── Final CTA ────────────────────────────────────────── */}
      <section className="px-8 py-24 border-t border-[var(--color-border-soft)] relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 50% 100%, rgba(57,255,20,0.08), transparent 60%)",
          }}
        />
        <div className="max-w-2xl mx-auto text-center relative">
          <Reveal>
            <h2 className="text-4xl md:text-5xl font-semibold mb-6">
              Start with a sample.
            </h2>
          </Reveal>
          <Reveal delay={100}>
            <p className="text-[var(--color-text-mid)] mb-10">
              Every prediction is an LLM-generated estimate, not financial
              advice. DealFlow is a research tool, not a brokerage.
            </p>
          </Reveal>
          <Reveal delay={200}>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Link href="/signup" className="btn-primary">
                Create an account
              </Link>
              <Link href="/sample" className="btn-ghost">
                Read a sample report
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Components
// ═══════════════════════════════════════════════════════════════════

function SiteNav() {
  return (
    <nav className="flex items-center justify-between px-8 py-6 border-b border-[var(--color-border-soft)]">
      <div className="flex items-center gap-3">
        <span
          className="text-[var(--color-neon)] text-xl"
          style={{ filter: "drop-shadow(0 0 6px var(--color-neon-glow))" }}
        >
          ⬡
        </span>
        <div className="flex flex-col leading-tight">
          <span className="font-bold text-[15px]">DealFlow</span>
          <span className="font-mono text-[10px] text-[var(--color-text-low)] uppercase tracking-wider">
            deal intelligence
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Link
          href="/methodology"
          className="hidden md:inline text-sm text-[var(--color-text-mid)] hover:text-[var(--color-neon)]"
        >
          Methodology
        </Link>
        <Link
          href="/sample"
          className="hidden md:inline text-sm text-[var(--color-text-mid)] hover:text-[var(--color-neon)]"
        >
          Sample
        </Link>
        <Link href="/login" className="btn-ghost">
          Sign in
        </Link>
        <Link href="/signup" className="btn-primary">
          Get started
        </Link>
      </div>
    </nav>
  );
}

function StatBlock({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <div
        className="text-3xl md:text-4xl font-bold text-[var(--color-neon)]"
        style={{ filter: "drop-shadow(0 0 12px var(--color-neon-glow))" }}
      >
        {value}
      </div>
      <div className="font-mono text-xs text-[var(--color-text-low)] uppercase tracking-wider mt-2">
        {label}
      </div>
    </div>
  );
}

function StageCard({
  index,
  title,
  glyph,
  body,
}: {
  index: string;
  title: string;
  glyph: string;
  body: string;
}) {
  return (
    <div className="panel-lg h-full">
      <div className="flex items-center justify-between mb-6">
        <span className="font-mono text-xs text-[var(--color-text-low)]">
          {index}
        </span>
        <span className="text-[var(--color-neon)] text-xl">{glyph}</span>
      </div>
      <h3 className="text-xl font-semibold mb-3">{title}</h3>
      <p className="text-sm text-[var(--color-text-mid)] leading-relaxed">
        {body}
      </p>
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="px-8 py-10 border-t border-[var(--color-border-soft)]">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-[var(--color-neon)]">⬡</span>
          <span className="text-sm text-[var(--color-text-low)]">
            DealFlow — autonomous VC analyst
          </span>
        </div>
        <div className="flex items-center gap-6 text-sm text-[var(--color-text-low)]">
          <Link href="/methodology" className="hover:text-[var(--color-neon)]">
            Methodology
          </Link>
          <Link href="/sample" className="hover:text-[var(--color-neon)]">
            Sample
          </Link>
          <Link href="/login" className="hover:text-[var(--color-neon)]">
            Sign in
          </Link>
        </div>
      </div>
      <div className="max-w-5xl mx-auto mt-6 text-center text-xs text-[var(--color-text-low)] font-mono">
        All predictions are LLM-generated estimates, not financial advice.
      </div>
    </footer>
  );
}