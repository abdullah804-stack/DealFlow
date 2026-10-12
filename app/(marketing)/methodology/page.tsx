import Link from "next/link";
import Image from "next/image";
import { Reveal } from "@/components/Reveal";

export const metadata = {
  title: "Methodology — DealFlow",
  description:
    "How the DealFlow investment committee scores startups: weights, thresholds, fast-path rules, and known limitations.",
};

// ─── Agent roster (kept in sync with landing page) ─────────────
const AGENTS = [
  {
    key: "technical",
    name: "Aris Bahri",
    title: "Technical Agent",
    weight: "25%",
    image: "/agents/technical.png",
    description:
      "Evaluates architecture, scalability, and whether the technical moat holds up under competitive pressure.",
  },
  {
    key: "finance",
    name: "Amara Okafor",
    title: "Finance Agent",
    weight: "25%",
    image: "/agents/finance.png",
    description:
      "Tests unit economics, TAM sizing, and the path from current revenue to a real business.",
  },
  {
    key: "marketing",
    name: "Rohan Mehta",
    title: "Marketing Agent",
    weight: "20%",
    image: "/agents/marketing.png",
    description:
      "Asks whether anyone actually wants this, and how the company reaches them without burning cash.",
  },
  {
    key: "legal",
    name: "Mei Tanaka",
    title: "Legal Agent",
    weight: "10%",
    image: "/agents/legal.png",
    description:
      "Surfaces compliance exposure, data handling obligations, and structural risk before it becomes a problem.",
  },
  {
    key: "founder",
    name: "Karim Haddad",
    title: "Founder Agent",
    weight: "20%",
    image: "/agents/founder.png",
    description:
      "Judges execution speed, team composition, and whether the founders can ship what they've promised.",
  },
];

const RUBRIC_WEIGHTS = [
  {
    agent: "Technical",
    weight: 0.25,
    note: "Moat, feasibility, technical differentiation",
  },
  {
    agent: "Finance",
    weight: 0.25,
    note: "Unit economics, TAM, path to revenue",
  },
  {
    agent: "Marketing",
    weight: 0.2,
    note: "Demand, positioning, go-to-market",
  },
  {
    agent: "Legal",
    weight: 0.1,
    note: "Regulatory, privacy, IP, compliance",
  },
  {
    agent: "Founder",
    weight: 0.2,
    note: "Execution speed, hiring, MVP scope",
  },
];

export default function MethodologyPage() {
  return (
    <main className="relative z-10">
      {/* ─── Hero ─────────────────────────────────────────────── */}
      <section className="px-8 py-16 md:py-24">
        <div className="max-w-3xl mx-auto">
          <Reveal>
            <div className="eyebrow mb-4">Methodology</div>
          </Reveal>
          <Reveal delay={100}>
            <h1 className="text-4xl md:text-5xl font-semibold mb-6 leading-tight">
              How DealFlow evaluates startups.
            </h1>
          </Reveal>
          <Reveal delay={200}>
            <p className="text-[var(--color-text-mid)] text-lg leading-relaxed">
              Five specialist agents score every candidate. Their weighted
              scores drive a deterministic decision —{" "}
              <span className="text-[var(--color-neon)]">INVEST</span>,{" "}
              <span className="text-[var(--color-neon-red)]">PASS</span>, or{" "}
              <span className="text-[var(--color-text-hi)]">
                INSUFFICIENT_EVIDENCE
              </span>
              . Voting is code, never an LLM call. This page explains the
              rubric and its limits.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ─── The rubric ───────────────────────────────────────── */}
      <section className="px-8 py-16 border-t border-[var(--color-border-soft)]">
        <div className="max-w-3xl mx-auto">
          <Reveal>
            <h2 className="section-heading text-2xl md:text-3xl font-semibold mb-4">
  The rubric
</h2>
            <p className="text-[var(--color-text-mid)] mb-10 leading-relaxed">
              Each agent scores from 0 to 10. Scores are combined using fixed
              weights. A weighted total of{" "}
              <span className="font-mono text-[var(--color-neon)]">6.5</span>{" "}
              or above produces INVEST; below{" "}
              <span className="font-mono text-[var(--color-neon-red)]">
                4.0
              </span>{" "}
              produces PASS.
            </p>
          </Reveal>

          <Reveal delay={100}>
            <div className="panel-lg !p-0 overflow-hidden">
              {RUBRIC_WEIGHTS.map((row, i) => (
                <div
                  key={row.agent}
                  className={`flex items-center gap-4 px-6 py-4 ${
                    i < RUBRIC_WEIGHTS.length - 1
                      ? "border-b border-[var(--color-border-soft)]"
                      : ""
                  }`}
                >
                  <div className="font-semibold w-32">{row.agent}</div>
                  <div className="font-mono text-sm text-[var(--color-neon)] w-16">
                    {(row.weight * 100).toFixed(0)}%
                  </div>
                  <div className="text-sm text-[var(--color-text-mid)] flex-1">
                    {row.note}
                  </div>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={200}>
            <div className="mt-8 grid grid-cols-2 gap-4">
              <div className="stat-card">
                <div className="stat-index">INVEST threshold</div>
                <div className="stat-number text-[var(--color-neon)]">6.5</div>
                <div className="stat-label">weighted /10</div>
              </div>
              <div className="stat-card">
                <div className="stat-index">PASS threshold</div>
                <div className="stat-number text-[var(--color-neon-red)]">
                  &lt; 4.0
                </div>
                <div className="stat-label">weighted /10</div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── Committee ────────────────────────────────────────── */}
      <section className="px-8 py-16 border-t border-[var(--color-border-soft)]">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <h2 className="section-heading text-2xl md:text-3xl font-semibold mb-4">
  The committee
</h2>
            <p className="text-[var(--color-text-mid)] mb-10 max-w-2xl leading-relaxed">
              Each agent is a distinct LLM persona with its own system prompt
              and evaluation criteria. They score independently, then reflect
              on each other&apos;s reasoning in a second round.
            </p>
          </Reveal>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
            {AGENTS.map((agent, i) => (
              <Reveal key={agent.key} delay={i * 80}>
                <div className="panel h-full flex flex-col overflow-hidden !p-0">
                  <div className="relative w-full aspect-[3/4]">
                    <Image
                      src={agent.image}
                      alt={agent.name}
                      fill
                      sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 20vw"
                      className="object-contain object-bottom"
                    />
                  </div>
                  <div className="p-4 text-center flex flex-col items-center">
                    <div className="font-semibold text-[14px] mb-1">
                      {agent.name}
                    </div>
                    <div className="font-mono text-[10px] text-[var(--color-text-low)] uppercase tracking-wider mb-2">
                      {agent.title}
                    </div>
                    <div className="font-mono text-xs text-[var(--color-neon)] mb-3">
                      {agent.weight}
                    </div>
                    <p className="text-[11px] text-[var(--color-text-mid)] leading-relaxed">
                      {agent.description}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Fast-path ────────────────────────────────────────── */}
      <section className="px-8 py-16 border-t border-[var(--color-border-soft)]">
        <div className="max-w-3xl mx-auto">
          <Reveal>
           <h2 className="section-heading text-2xl md:text-3xl font-semibold mb-4">
  Fast-path
</h2>
            <p className="text-[var(--color-text-mid)] leading-relaxed mb-8">
              When the committee agrees strongly, a second round is
              unnecessary. The system detects this and skips it.
            </p>
          </Reveal>

          <Reveal delay={100}>
            <div className="space-y-4">
              <div className="panel">
                <div className="flex items-start gap-4">
                  <span className="text-[var(--color-neon)] text-xl">↑</span>
                  <div>
                    <div className="font-semibold mb-1">Auto-approve</div>
                    <div className="text-sm text-[var(--color-text-mid)] leading-relaxed">
                      Every agent scores{" "}
                      <span className="font-mono text-[var(--color-neon)]">
                        8.5
                      </span>{" "}
                      or higher in round one. The committee returns INVEST
                      without a reflection round.
                    </div>
                  </div>
                </div>
              </div>

              <div className="panel">
                <div className="flex items-start gap-4">
                  <span className="text-[var(--color-neon-red)] text-xl">
                    ↓
                  </span>
                  <div>
                    <div className="font-semibold mb-1">Auto-reject</div>
                    <div className="text-sm text-[var(--color-text-mid)] leading-relaxed">
                      Every agent scores{" "}
                      <span className="font-mono text-[var(--color-neon-red)]">
                        3.0
                      </span>{" "}
                      or lower in round one. The committee returns PASS
                      without a reflection round.
                    </div>
                  </div>
                </div>
              </div>

              <div className="panel">
                <div className="flex items-start gap-4">
                  <span className="text-[var(--color-text-mid)] text-xl">
                    ↔
                  </span>
                  <div>
                    <div className="font-semibold mb-1">Mixed scores</div>
                    <div className="text-sm text-[var(--color-text-mid)] leading-relaxed">
                      Round 2 runs. Agents see the other four scores and
                      short summaries, then confirm or revise their own.
                      Final vote uses round 2 scores.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── Insufficient evidence ────────────────────────────── */}
      <section className="px-8 py-16 border-t border-[var(--color-border-soft)]">
        <div className="max-w-3xl mx-auto">
          <Reveal>
            <h2 className="section-heading text-2xl md:text-3xl font-semibold mb-4">
  Insufficient evidence
</h2>
            <p className="text-[var(--color-text-mid)] leading-relaxed mb-6">
              Sometimes the dossier doesn&apos;t contain enough information to
              make a confident call. Rather than fabricate a score, the
              system flags it.
            </p>
          </Reveal>

          <Reveal delay={100}>
            <div className="panel-lg">
              <p className="text-sm text-[var(--color-text-mid)] leading-relaxed">
                If three or more agents each report three or more{" "}
                <span className="text-[var(--color-text-hi)]">unknowns</span>{" "}
                on critical fields — finance, pricing, feasibility, customer,
                market, or traction — the committee returns{" "}
                <span className="font-mono text-[var(--color-neon)]">
                  INSUFFICIENT_EVIDENCE
                </span>{" "}
                instead of a forced score. This is a valid outcome, not an
                error.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── Limitations ──────────────────────────────────────── */}
      <section className="px-8 py-16 border-t border-[var(--color-border-soft)]">
        <div className="max-w-3xl mx-auto">
          <Reveal>
            <h2 className="section-heading text-2xl md:text-3xl font-semibold mb-4">
  Limitations
</h2>
            <p className="text-[var(--color-text-mid)] leading-relaxed mb-8">
              DealFlow is a research tool, not an investment advisor. We
              prefer to state its boundaries explicitly.
            </p>
          </Reveal>

          <Reveal delay={100}>
            <ul className="space-y-3">
              {[
                "Predictions are LLM-generated estimates, not statistically calibrated forecasts.",
                "The committee has no information beyond what appears in each dossier and interview answer.",
                "Scores are not comparable across time — the rubric is versioned, but the underlying LLMs are not deterministic.",
                "The backtest demonstrates the mechanism on a small curated sample. It is not predictive proof.",
                "DealFlow does not execute trades and does not integrate with any brokerage or payment system. Ever.",
                "Discovery sources are limited to Hacker News, Reddit, and startup RSS feeds. No Product Hunt, AngelList, or GitHub Trending in v1.",
              ].map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 text-sm text-[var(--color-text-mid)] leading-relaxed"
                >
                  <span className="text-[var(--color-neon-red)] mt-1">—</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* ─── CTA ──────────────────────────────────────────────── */}
      <section className="px-8 py-20 border-t border-[var(--color-border-soft)] relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 50% 100%, rgba(57,255,20,0.08), transparent 60%)",
          }}
        />
        <div className="max-w-2xl mx-auto text-center relative">
          <Reveal>
            <h2 className="text-3xl md:text-4xl font-semibold mb-6">
              See it in practice.
            </h2>
          </Reveal>
          <Reveal delay={100}>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Link href="/sample" className="btn-ghost">
                Read a sample report
              </Link>
              <Link href="/signup" className="btn-primary">
                Evaluate your own idea
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}