"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 12);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // On mobile, always solid. On desktop, transparent until scrolled.
  return (
    <header
      className={`site-header ${
        scrolled ? "site-header-solid" : "site-header-transparent"
      }`}
    >
      <div className="flex items-center justify-between px-5 md:px-8 py-4 md:py-5">
        <Logo />
        <div className="flex items-center gap-2 md:gap-3">
          <Link
            href="/methodology"
            className="hidden md:inline text-sm text-[var(--color-text-mid)] hover:text-[var(--color-neon)] transition-colors"
          >
            Methodology
          </Link>
          <Link
            href="/sample"
            className="hidden md:inline text-sm text-[var(--color-text-mid)] hover:text-[var(--color-neon)] transition-colors"
          >
            Sample
          </Link>
          <Link href="/login" className="btn-ghost text-xs md:text-sm">
            Sign in
          </Link>
          <Link href="/signup" className="btn-primary text-xs md:text-sm">
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}