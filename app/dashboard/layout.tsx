import Link from "next/link";
import { requireUserId } from "@/lib/authz";
import { signOut } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUserId();

  return (
    <div className="relative z-10 grid grid-cols-[236px_1fr] min-h-screen">
      <aside className="bg-[var(--color-bg-raise)] border-r border-[var(--color-border-soft)] flex flex-col p-6">
        <div className="flex items-center gap-3 pb-6 border-b border-[var(--color-border-soft)] mb-6">
          <span className="text-[var(--color-teal)] text-xl">⬡</span>
          <div className="flex flex-col leading-tight">
            <span className="font-bold text-[15px]">DealFlow</span>
            <span className="font-mono text-[10px] text-[var(--color-text-low)] uppercase tracking-wider">
              deal intelligence
            </span>
          </div>
        </div>

        <nav className="flex-1 flex flex-col gap-1">
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

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
          className="border-t border-[var(--color-border-soft)] pt-4"
        >
          <button type="submit" className="btn-ghost w-full text-left">
            Sign out
          </button>
        </form>
      </aside>

      <div className="flex flex-col min-w-0">
        <main className="flex-1 p-8">{children}</main>
        <footer className="px-8 py-6 border-t border-[var(--color-border-soft)] text-center">
          <p className="text-[var(--color-text-low)] text-xs">
            All predictions are LLM-generated estimates, not financial advice.
          </p>
        </footer>
      </div>
    </div>
  );
}