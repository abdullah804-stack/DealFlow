import Link from "next/link";
import Image from "next/image";
import { Logo } from "@/components/Logo";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative z-10">
      <nav className="flex items-center justify-between px-8 py-6 border-b border-[var(--color-border-soft)]">
        <Logo />
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

      {children}

      <footer className="px-8 py-10 border-t border-[var(--color-border-soft)]">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="DealFlow"
              width={24}
              height={24}
              className="rounded"
            />
            <span className="text-sm text-[var(--color-text-low)]">
              DealFlow — autonomous VC analyst
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-[var(--color-text-low)]">
            <Link href="/methodology" className="hover:text-[var(--color-neon)]">
              Methodology
            </Link>
            <Link href="/privacy" className="hover:text-[var(--color-neon)]">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-[var(--color-neon)]">
              Terms
            </Link>
          </div>
        </div>
        <div className="max-w-5xl mx-auto mt-6 text-center text-xs text-[var(--color-text-low)] font-mono">
          All predictions are LLM-generated estimates, not financial advice.
        </div>
      </footer>
    </div>
  );
}