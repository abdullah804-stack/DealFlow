import Link from "next/link";
import Image from "next/image";
import { SiteHeader } from "@/components/SiteHeader";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative z-10">
      <SiteHeader />

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