import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { Reveal } from "@/components/Reveal";

export const dynamic = "force-dynamic";

const AGENTS = [
  {
    key: "technical",
    name: "Aris Bahri",
    title: "Technical Agent",
    weight: "25%",
    image: "/agents/technical.png",
    description:
      "Former infrastructure lead. Evaluates architecture, scalability, and whether the technical moat holds up under competitive pressure.",
  },
  {
    key: "finance",
    name: "Amara Okafor",
    title: "Finance Agent",
    weight: "25%",
    image: "/agents/finance.png",
    description:
      "Ex-growth equity analyst. Tests unit economics, TAM sizing, and the path from current revenue to a real business.",
  },
  {
    key: "marketing",
    name: "Rohan Mehta",
    title: "Marketing Agent",
    weight: "20%",
    image: "/agents/marketing.png",
    description:
      "Operating CMO background. Asks whether anyone actually wants this, and how the company reaches them without burning cash.",
  },
  {
    key: "legal",
    name: "Mei Tanaka",
    title: "Legal Agent",
    weight: "10%",
    image: "/agents/legal.png",
    description:
      "Regulatory and IP counsel. Surfaces compliance exposure, data handling obligations, and structural risk before it becomes a problem.",
  },
  {
    key: "founder",
    name: "Karim Haddad",
    title: "Founder Agent",
    weight: "20%",
    image: "/agents/founder.png",
    description:
      "Two prior exits. Judges execution speed, team composition, and whether the founders can ship what they've promised.",
  },
];

const FAQ = [
  {
    q: "Is this real investment advice?",
    a: "No. DealFlow is a research tool. Every prediction, score, and check size is an LLM-generated estimate — not a calibrated statistical forecast. Nothing here should inform an actual investment decision.",
  },
  {
    q: "Where do the discovered startups come from?",
    a: "Hacker News, Reddit, startup RSS feeds, and the Y Combinator company directory. We do not use Product Hunt, AngelList, or GitHub Trending — none of them offer reliable free access at scale.",
  },
  {
    q: "How is this different from just asking ChatGPT?",
    a: "Two things. First, the committee is deterministic: five independent specialists score against a locked rubric, and voting is code, not another LLM call. Second, every report is stored with full disagreement history, so you can see exactly why the committee concluded what it did.",
  },
  {
    q: "What happens to my idea if I submit it?",
    a: "It stays on your account. We don't train models on it, sell it, or share it with anyone except the infrastructure providers listed in our privacy policy. You can request deletion at any time.",
  },
  {
    q: "Can I trust the scores?",
    a: "Treat them as a structured opinion, not a prediction. The rubric is locked and versioned. The underlying LLMs are not deterministic, so scores can shift if you re-run the same idea — but the weights and thresholds never do.",
  },
  {
    q: "What does the daily pipeline actually do?",
    a: "Every 24 hours at 06:00 UTC, a Python process pulls new candidates, deduplicates them, ranks them, and runs the top three through the full committee. The results are visible in the discovery feed the moment they land.",
  },
];

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
    <main className="relative z-10 overflow-hidden">
      {/* ═══════════════════════════════════════════════════════
          1. HERO
         ═══════════════════════════════════════════════════════ */}
      <section className="relative px-6 md:px-8 py-16 md:py-32">
        <div
          className="glow-orb glow-orb-neon glow-orb-animate"
          style={{ width: 380, height: 380, top: -120, left: "10%" }}
          aria-hidden
        />
        <div
          className="glow-orb glow-orb-red glow-orb-animate"
          style={{
            width: 320,
            height: 320,
            top: 100,
            right: "-20%",
            animationDelay: "3s",
          }}
          aria-hidden
        />

        <div className="max-w-5xl mx-auto relative">
          <Reveal>
            <div className="eyebrow text-center mb-6">
              Autonomous investment committee
            </div>
          </Reveal>
          <Reveal delay={100}>
            <h1 className="text-4xl md:text-6xl font-semibold text-center leading-[1.1] md:leading-[1.08] tracking-tight mb-6">
              An analyst that never
              <br />
              <span className="gradient-text-neon">closes its terminal.</span>
            </h1>
          </Reveal>
          <Reveal delay={200}>
            <p className="text-[var(--color-text-mid)] text-base md:text-xl leading-relaxed max-w-2xl mx-auto text-center mb-8 md:mb-10">
              DealFlow discovers new startups every day, filters them through
              a validation layer, and runs the strongest candidates through a
              five-agent investment committee that debates and votes —
              autonomously, at 06:00 UTC.
            </p>
          </Reveal>
          <Reveal delay={300}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <Link href="/signup" className="btn-primary w-full sm:w-auto text-center">
                Start exploring
              </Link>
              <Link href="/sample" className="btn-ghost w-full sm:w-auto text-center">
                See a sample report
              </Link>
            </div>
          </Reveal>

          <Reveal delay={500}>
            <div className="mt-12 md:mt-20 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-2xl mx-auto">
              <StatBlock value={stats.candidates} label="Candidates discovered" />
              <StatBlock value={stats.reports} label="Reports generated" />
              <StatBlock value={stats.evaluations} label="Ideas evaluated" />
            </div>
          </Reveal>
        </div>
      </section>

      <div className="border-beam" />

      {/* ═══════════════════════════════════════════════════════
          2. THE PROBLEM
         ═══════════════════════════════════════════════════════ */}
      <section className="relative px-6 md:px-8 py-16 md:py-24">
        <div className="max-w-4xl mx-auto text-center">
          <Reveal>
            <div className="eyebrow mb-4">The problem</div>
          </Reveal>
          <Reveal delay={100}>
            <h2 className="text-2xl md:text-5xl font-semibold leading-tight mb-6 md:mb-8">
              There are more startups every day than any investor can track.
            </h2>
          </Reveal>
          <Reveal delay={200}>
            <p className="text-[var(--color-text-mid)] text-base md:text-lg leading-relaxed max-w-2xl mx-auto mb-6">
              Every 24 hours, thousands of founders launch something. A
              handful are genuinely worth attention. The signal is buried in
              the noise — Hacker News posts, Reddit threads, and RSS feeds
              that scroll past before anyone serious reads them.
            </p>
          </Reveal>
          <Reveal delay={300}>
            <p className="text-[var(--color-text-mid)] text-base md:text-lg leading-relaxed max-w-2xl mx-auto">
              Human analysts triage a fraction of it. DealFlow triages all of
              it — every single day, without being asked.
            </p>
          </Reveal>
        </div>
      </section>

      <div className="border-beam" />

      {/* ═══════════════════════════════════════════════════════
          3. HOW IT WORKS
         ═══════════════════════════════════════════════════════ */}
      <section className="relative px-6 md:px-8 py-16 md:py-24">
        <div
          className="glow-orb glow-orb-neon glow-orb-animate"
          style={{ width: 320, height: 320, top: "20%", left: "-20%" }}
          aria-hidden
        />
        <div className="max-w-5xl mx-auto relative">
          <Reveal>
            <div className="text-center mb-10 md:mb-16">
              <div className="eyebrow mb-4">How it works</div>
              <h2 className="text-2xl md:text-4xl font-semibold">
                Three stages, one pipeline.
              </h2>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Reveal delay={100}>
              <StageCard
                index="01"
                title="Discover"
                glyph="▽"
                body="Pulls fresh candidates from Hacker News, Reddit, RSS feeds, and the YC directory. Classifies each one with an LLM pass and deduplicates by canonical domain."
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

      <div className="border-beam" />

      {/* ═══════════════════════════════════════════════════════
          4. THE COMMITTEE
         ═══════════════════════════════════════════════════════ */}
      <section className="relative px-6 md:px-8 py-16 md:py-24">
        <div
          className="glow-orb glow-orb-violet glow-orb-animate"
          style={{
            width: 400,
            height: 400,
            bottom: "-10%",
            right: "-30%",
            animationDelay: "5s",
          }}
          aria-hidden
        />
        <div className="max-w-6xl mx-auto relative">
          <Reveal>
            <div className="text-center mb-10 md:mb-16">
              <div className="eyebrow mb-4">The committee</div>
              <h2 className="text-2xl md:text-4xl font-semibold">
                Five specialists, one vote.
              </h2>
              <p className="text-[var(--color-text-mid)] mt-4 max-w-2xl mx-auto text-sm md:text-base">
                Each agent has a distinct mandate and a fixed weight. The
                rubric is locked — same weights, same thresholds, every run.
              </p>
            </div>
          </Reveal>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-5">
            {AGENTS.map((agent, i) => (
              <Reveal key={agent.key} delay={i * 80}>
                <AgentCard agent={agent} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <div className="border-beam" />

      {/* ═══════════════════════════════════════════════════════
          5. SAMPLE OUTPUT
         ═══════════════════════════════════════════════════════ */}
      <section className="relative px-6 md:px-8 py-16 md:py-24">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
            <Reveal>
              <div>
                <div className="eyebrow mb-4">Sample output</div>
                <h2 className="text-2xl md:text-4xl font-semibold mb-6 leading-tight">
                  Full investment memos,
                  <br />
                  written in seconds.
                </h2>
                <p className="text-[var(--color-text-mid)] leading-relaxed mb-6 text-sm md:text-base">
                  Every escalated candidate gets a VC-memo-style report:
                  executive summary, competitive landscape, technical and
                  financial analysis, committee debate, and a final
                  recommendation. Ten sections, structured the way a real
                  analyst would write them.
                </p>
                <ul className="space-y-3 mb-8">
                  {[
                    "Executive summary and investment thesis",
                    "Technology, market, financial, and legal analysis",
                    "Full committee debate with disagreements surfaced",
                    "Star rating, success probability, suggested check size",
                  ].map((item, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 text-sm text-[var(--color-text-mid)]"
                    >
                      <span className="text-[var(--color-neon)] mt-0.5">
                        ✓
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/sample" className="btn-primary inline-block">
                  Read a full sample →
                </Link>
              </div>
            </Reveal>

            <Reveal delay={200}>
              <div className="panel-lg md:slow-float">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-[var(--color-border-soft)]">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-[var(--color-neon)] pulse-glow" />
                    <span className="font-mono text-xs text-[var(--color-text-low)] uppercase tracking-wider">
                      Sample memo
                    </span>
                  </div>
                  <span className="badge-invest">INVEST</span>
                </div>
                <div className="space-y-4 text-sm">
                  <div>
                    <div className="font-mono text-[10px] text-[var(--color-text-low)] uppercase tracking-wider mb-2">
                      Executive summary
                    </div>
                    <p className="text-[var(--color-text-mid)] leading-relaxed">
                      Healthleap is building an AI system that flags hospital
                      patients who need a closer look before complications
                      escalate. The technical foundation is strong and the
                      regulatory path is navigable, but adoption cycles in
                      hospital procurement are longer than the deck assumes.
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 pt-4 border-t border-[var(--color-border-soft)]">
                    <MiniStat label="Rating" value="3/5" tone="amber" />
                    <MiniStat label="Est. success" value="65%" tone="neon" />
                    <MiniStat label="Check size" value="$250k" tone="violet" />
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <div className="border-beam" />

      {/* ═══════════════════════════════════════════════════════
          6. WHO IT'S FOR
         ═══════════════════════════════════════════════════════ */}
      <section className="relative px-6 md:px-8 py-16 md:py-24">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="text-center mb-10 md:mb-16">
              <div className="eyebrow mb-4">Who it&apos;s for</div>
              <h2 className="text-2xl md:text-4xl font-semibold">
                Built for the people drowning in deal flow.
              </h2>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Reveal delay={100}>
              <AudienceCard
                glyph="◆"
                title="Angel investors"
                body="See a curated slice of the week's new startups, with structured analysis you'd otherwise have to write yourself."
              />
            </Reveal>
            <Reveal delay={200}>
              <AudienceCard
                glyph="◈"
                title="Scout and analyst teams"
                body="Use the committee output as a first-pass memo. Filter 100 candidates down to the five worth a partner meeting."
              />
            </Reveal>
            <Reveal delay={300}>
              <AudienceCard
                glyph="◇"
                title="Founders evaluating their own idea"
                body="Run your idea through the same five specialists that evaluate discovered startups. Get honest, structured feedback before you pitch."
              />
            </Reveal>
          </div>
        </div>
      </section>

      <div className="border-beam" />

      {/* ═══════════════════════════════════════════════════════
          7. WHY IT'S DIFFERENT
         ═══════════════════════════════════════════════════════ */}
      <section className="relative px-6 md:px-8 py-16 md:py-24">
        <div
          className="glow-orb glow-orb-neon glow-orb-animate"
          style={{
            width: 320,
            height: 320,
            top: "10%",
            right: "-20%",
            animationDelay: "7s",
          }}
          aria-hidden
        />
        <div className="max-w-4xl mx-auto relative">
          <Reveal>
            <div className="text-center mb-10 md:mb-16">
              <div className="eyebrow mb-4">Why it&apos;s different</div>
              <h2 className="text-2xl md:text-4xl font-semibold">
                A committee, not a chatbot.
              </h2>
            </div>
          </Reveal>

          <div className="space-y-4 md:space-y-6">
            <Reveal delay={100}>
              <DifferentRow
                glyph="◈"
                title="Five independent perspectives"
                body="Each specialist is a distinct LLM persona with its own system prompt, its own mandate, and its own scoring criteria. They don't see each other's initial scores."
              />
            </Reveal>
            <Reveal delay={200}>
              <DifferentRow
                glyph="◆"
                title="Deterministic voting"
                body="Scores are combined by code with fixed weights. The final decision is arithmetic, not another LLM opinion. Rerun the same scores and you get the same answer."
              />
            </Reveal>
            <Reveal delay={300}>
              <DifferentRow
                glyph="◇"
                title="Disagreement is visible"
                body="When specialists disagree, the report shows it. Rounds of reflection are stored alongside the final vote, so you can see which agents changed their minds and why."
              />
            </Reveal>
            <Reveal delay={400}>
              <DifferentRow
                glyph="▽"
                title="It says when it doesn't know"
                body="If three or more specialists flag critical unknowns, the committee returns INSUFFICIENT_EVIDENCE rather than forcing a score. It's a valid answer, and we treat it as one."
              />
            </Reveal>
          </div>
        </div>
      </section>

      <div className="border-beam" />

      {/* ═══════════════════════════════════════════════════════
          8. FAQ
         ═══════════════════════════════════════════════════════ */}
      <section className="relative px-6 md:px-8 py-16 md:py-24">
        <div className="max-w-3xl mx-auto">
          <Reveal>
            <div className="text-center mb-10 md:mb-16">
              <div className="eyebrow mb-4">FAQ</div>
              <h2 className="text-2xl md:text-4xl font-semibold">
                Common questions.
              </h2>
            </div>
          </Reveal>

          <div className="space-y-3">
            {FAQ.map((item, i) => (
              <Reveal key={i} delay={i * 60}>
                <details className="panel group">
                  <summary className="cursor-pointer list-none flex items-center justify-between gap-4">
                    <span className="font-medium text-[var(--color-text-hi)] text-sm md:text-base">
                      {item.q}
                    </span>
                    <span className="text-[var(--color-neon)] font-mono transition-transform group-open:rotate-45 flex-shrink-0">
                      +
                    </span>
                  </summary>
                  <p className="mt-4 pt-4 border-t border-[var(--color-border-soft)] text-sm text-[var(--color-text-mid)] leading-relaxed">
                    {item.a}
                  </p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          9. FINAL CTA
         ═══════════════════════════════════════════════════════ */}
      <section className="relative px-6 md:px-8 py-20 md:py-32">
        <div
          className="glow-orb glow-orb-neon glow-orb-animate"
          style={{
            width: 500,
            height: 500,
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            opacity: 0.25,
          }}
          aria-hidden
        />
        <div className="max-w-2xl mx-auto text-center relative">
          <Reveal>
            <div className="eyebrow mb-6">Get started</div>
          </Reveal>
          <Reveal delay={100}>
            <h2 className="text-3xl md:text-6xl font-semibold mb-6 leading-tight">
              Start with a sample.
            </h2>
          </Reveal>
          <Reveal delay={200}>
            <p className="text-[var(--color-text-mid)] text-base md:text-lg mb-8 md:mb-10 max-w-lg mx-auto">
              Read a real committee report. Or submit your own idea and see
              what the five specialists have to say.
            </p>
          </Reveal>
          <Reveal delay={300}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <Link
                href="/signup"
                className="btn-primary w-full sm:w-auto text-center"
              >
                Create an account
              </Link>
              <Link
                href="/sample"
                className="btn-ghost w-full sm:w-auto text-center"
              >
                Read a sample report
              </Link>
            </div>
          </Reveal>
          <Reveal delay={500}>
            <p className="text-xs text-[var(--color-text-low)] font-mono mt-10 md:mt-12">
              All predictions are LLM-generated estimates, not financial
              advice.
            </p>
          </Reveal>
        </div>
      </section>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════

function StatBlock({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <div
        className="text-3xl md:text-4xl font-bold text-[var(--color-neon)] stat-glow"
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
    <div className="panel-lg h-full group hover:border-[var(--color-neon)] transition-all duration-300 hover:-translate-y-1">
      <div className="flex items-center justify-between mb-6">
        <span className="font-mono text-xs text-[var(--color-text-low)]">
          {index}
        </span>
        <span className="text-[var(--color-neon)] text-xl transition-transform group-hover:scale-110">
          {glyph}
        </span>
      </div>
      <h3 className="text-lg md:text-xl font-semibold mb-3">{title}</h3>
      <p className="text-sm text-[var(--color-text-mid)] leading-relaxed">
        {body}
      </p>
    </div>
  );
}

function AgentCard({ agent }: { agent: (typeof AGENTS)[number] }) {
  return (
    <div
      className="agent-card group"
      tabIndex={0}
      aria-label={`${agent.name}, ${agent.title}`}
    >
      <div className="agent-card-glow" aria-hidden />
      <div className="agent-card-scan" aria-hidden />

      <div className="relative w-full aspect-[3/4] z-10">
        <Image
          src={agent.image}
          alt={agent.name}
          fill
          sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 20vw"
          className="object-contain object-bottom agent-card-image"
          priority={false}
        />
      </div>

      <div className="p-3 md:p-5 text-center flex flex-col items-center relative z-10">
        <div className="font-semibold text-[13px] md:text-[15px] mb-1 transition-colors group-hover:text-[var(--color-neon)]">
          {agent.name}
        </div>
        <div className="font-mono text-[9px] md:text-[10px] text-[var(--color-text-low)] uppercase tracking-wider mb-2 md:mb-3">
          {agent.title}
        </div>
        <div className="font-mono text-xs text-[var(--color-neon)] mb-3 md:mb-4 transition-all group-hover:drop-shadow-[0_0_8px_var(--color-neon-glow)]">
          {agent.weight}
        </div>
        <p className="text-[10px] md:text-xs text-[var(--color-text-mid)] leading-relaxed">
          {agent.description}
        </p>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "amber" | "neon" | "violet";
}) {
  const toneClass =
    tone === "amber"
      ? "text-[var(--color-amber)]"
      : tone === "neon"
      ? "text-[var(--color-neon)]"
      : "text-[var(--color-violet)]";

  return (
    <div>
      <div className="font-mono text-[9px] md:text-[10px] text-[var(--color-text-low)] uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className={`text-base md:text-lg font-bold ${toneClass}`}>
        {value}
      </div>
    </div>
  );
}

function AudienceCard({
  glyph,
  title,
  body,
}: {
  glyph: string;
  title: string;
  body: string;
}) {
  return (
    <div className="panel-lg h-full group hover:border-[var(--color-neon)] transition-all duration-300 hover:-translate-y-1">
      <div className="text-[var(--color-neon)] text-3xl mb-5 transition-transform group-hover:scale-110">
        {glyph}
      </div>
      <h3 className="text-lg font-semibold mb-3">{title}</h3>
      <p className="text-sm text-[var(--color-text-mid)] leading-relaxed">
        {body}
      </p>
    </div>
  );
}

function DifferentRow({
  glyph,
  title,
  body,
}: {
  glyph: string;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-start gap-4 md:gap-5 panel-lg hover:border-[var(--color-neon)] transition-colors duration-300">
      <span className="text-[var(--color-neon)] text-xl md:text-2xl flex-shrink-0 mt-1">
        {glyph}
      </span>
      <div>
        <h3 className="font-semibold text-base md:text-lg mb-2">{title}</h3>
        <p className="text-sm text-[var(--color-text-mid)] leading-relaxed">
          {body}
        </p>
      </div>
    </div>
  );
}