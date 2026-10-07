"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError("Invalid email or password.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="relative z-10 min-h-screen flex items-center justify-center px-8">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="block text-center mb-8 text-[var(--color-teal)] text-2xl"
        >
          ⬡
        </Link>
        <div className="panel-lg">
          <div className="eyebrow mb-2">Welcome back</div>
          <h1 className="text-2xl font-semibold mb-8">Sign in to DealFlow</h1>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="field-label">Email</label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="password" className="field-label">Password</label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <p className="text-[var(--color-coral)] text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[var(--color-text-mid)]">
            No account?{" "}
            <Link href="/signup" className="text-[var(--color-teal)]">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}