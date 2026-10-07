import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="relative z-10 min-h-screen flex flex-col">
      <nav className="flex items-center justify-between px-8 py-6 border-b border-[var(--color-border-soft)]">
        <div className="flex items-center gap-3">
          <span className="text-[var(--color-teal)] text-xl">⬡</span>
          <div className="flex flex-col leading-tight">
            <span className="font-bold text-[15px]">DealFlow</span>
            <span className="font-mono text-[10px] text-[var(--color-text-low)] uppercase tracking-wider">
              deal intelligence
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="btn-ghost">Sign in</Link>
          <Link href="/signup" className="btn-primary">Get started</Link>
        </div>
      </nav>

      <section className="flex-1 flex items-center justify-center px-8 py-24">
        <div className="max-w-3xl text-center">
          <div className="eyebrow mb-6">Autonomous evaluation engine</div>
          <h1 className="text-5xl font-semibold leading-[1.15] tracking-tight mb-6">
            An analyst that never
            <br />
            closes its terminal.
          </h1>
          <p className="text-[var(--color-text-mid)] text-lg leading-relaxed max-w-xl mx-auto mb-10">
            Every 24 hours, unprompted, DealFlow discovers new startups,
            filters them down, builds dossiers, and runs them through a
            five-agent investment committee that debates and votes.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/signup" className="btn-primary">Start exploring</Link>
            <Link href="/methodology" className="btn-ghost">Read the methodology</Link>
          </div>
        </div>
      </section>

      <footer className="px-8 py-6 border-t border-[var(--color-border-soft)] text-center">
        <p className="text-[var(--color-text-low)] text-xs">
          All predictions are LLM-generated estimates, not financial advice.
        </p>
      </footer>
    </main>
  );
}