import Link from "next/link";

export default function NotFound() {
  return (
    <main className="relative z-10 min-h-screen flex items-center justify-center px-8">
      <div className="max-w-md text-center">
        <div className="text-4xl mb-4 text-[var(--color-text-low)]">◌</div>
        <div className="eyebrow mb-2">404</div>
        <h1 className="text-2xl font-semibold mb-3">Page not found</h1>
        <p className="text-sm text-[var(--color-text-mid)] mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link href="/" className="btn-primary inline-block">
          Back to home
        </Link>
      </div>
    </main>
  );
}