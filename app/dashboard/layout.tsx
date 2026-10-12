import Link from "next/link";
import Image from "next/image";
import { requireUserId } from "@/lib/authz";
import { signOut } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUserId();

  return (
    <div className="relative z-10 min-h-screen flex flex-col md:grid md:grid-cols-[236px_1fr]">
      {/* ─── Sidebar (desktop) / Top bar (mobile) ─────────────── */}
      <aside className="bg-[var(--color-bg-raise)] border-b md:border-b-0 md:border-r border-[var(--color-border-soft)] flex flex-col md:flex-col p-4 md:p-6">
        {/* Logo row */}
        <div className="flex items-center justify-between md:block pb-4 md:pb-6 border-b border-[var(--color-border-soft)] md:mb-6">
          <Link href="/dashboard" className="logo-link flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="DealFlow"
              width={26}
              height={26}
              priority
              className="rounded"
            />
            <span className="font-bold text-[16px] tracking-tight">
              DealFlow
            </span>
          </Link>

          {/* Sign out on mobile — top-right */}
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
            className="md:hidden"
          >
            <button
              type="submit"
              className="text-xs font-mono text-[var(--color-text-low)] hover:text-[var(--color-neon-red)]"
            >
              Sign out
            </button>
          </form>
        </div>

        {/* Nav */}
        <nav className="flex md:flex-col gap-1 md:gap-1 overflow-x-auto md:overflow-x-visible mt-3 md:mt-0 flex-1 pb-1">
          <Link href="/dashboard" className="nav-item">
            <span className="nav-ico">◈</span>
            <span>Dashboard</span>
          </Link>
          <Link href="/dashboard/discover" className="nav-item">
            <span className="nav-ico">▽</span>
            <span>Discover</span>
          </Link>
          <Link href="/dashboard/reports" className="nav-item">
            <span className="nav-ico">▤</span>
            <span>Reports</span>
          </Link>
          <Link href="/dashboard/evaluate" className="nav-item">
            <span className="nav-ico">◇</span>
            <span>Evaluate</span>
          </Link>
          <Link href="/dashboard/settings" className="nav-item">
            <span className="nav-ico">⚙</span>
            <span>Settings</span>
          </Link>
        </nav>

        {/* Sign out — desktop only */}
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
          className="hidden md:block border-t border-[var(--color-border-soft)] pt-4 mt-4"
        >
          <button type="submit" className="btn-ghost w-full text-left">
            Sign out
          </button>
        </form>
      </aside>

      {/* ─── Main content ──────────────────────────────────────── */}
      <div className="flex flex-col min-w-0">
        <main className="flex-1 p-4 md:p-8">{children}</main>
        <footer className="px-4 md:px-8 py-6 border-t border-[var(--color-border-soft)] text-center">
          <p className="text-[var(--color-text-low)] text-xs">
            All predictions are LLM-generated estimates, not financial advice.
          </p>
        </footer>
      </div>
    </div>
  );
}