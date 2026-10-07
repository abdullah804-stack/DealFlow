export default function MethodologyPage() {
  return (
    <main className="relative z-10 min-h-screen px-8 py-16">
      <div className="max-w-3xl mx-auto">
        <div className="eyebrow mb-4">Methodology</div>
        <h1 className="text-4xl font-semibold mb-8">
          How the committee works
        </h1>

        <div className="panel-lg space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">The rubric</h2>
            <p className="text-[var(--color-text-mid)] leading-relaxed">
              Five specialist agents score every candidate from 0 to 10. Their
              scores are combined with fixed weights: Technical 25%, Finance
              25%, Marketing 20%, Legal 10%, Founder 20%. Voting is
              deterministic code — never an LLM call. A weighted score of 6.5
              or above produces an INVEST recommendation; below 4.0, a PASS.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">The fast-path</h2>
            <p className="text-[var(--color-text-mid)] leading-relaxed">
              If all five specialists score 8.5 or above in round one, the
              committee auto-approves and skips reflection. If all five score
              3.0 or below, it auto-rejects. Otherwise, a second round runs
              where specialists see each other&apos;s opinions and may revise
              their scores.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Limitations</h2>
            <p className="text-[var(--color-text-mid)] leading-relaxed">
              This is a research and recommendation system, not investment
              advice. Predictions are LLM-generated estimates, not statistically
              calibrated. The backtest on the dashboard is a demonstration
              against a small curated sample, not predictive proof.
            </p>
          </section>
        </div>

        <div className="mt-8 text-center">
          <a href="/" className="btn-ghost">← Back to home</a>
        </div>
      </div>
    </main>
  );
}