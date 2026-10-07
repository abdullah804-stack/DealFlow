"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/v1/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    if (!res.ok) {
      setLoading(false);
      const body = await res.json().catch(() => ({}));
      setError(body?.error?.message ?? "Could not create account.");
      return;
    }

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);
    if (result?.error) {
      setError("Account created, but sign-in failed. Try logging in.");
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
          <div className="eyebrow mb-2">Get started</div>
          <h1 className="text-2xl font-semibold mb-8">Create your account</h1>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="name" className="field-label">Name</label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

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
                minLength={8}
                autoComplete="new-password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="mt-2 text-xs text-[var(--color-text-low)]">
                At least 8 characters.
              </p>
            </div>

            {error && (
              <p className="text-[var(--color-coral)] text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[var(--color-text-mid)]">
            Already have one?{" "}
            <Link href="/login" className="text-[var(--color-teal)]">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}