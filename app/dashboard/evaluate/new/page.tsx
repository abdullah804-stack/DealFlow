"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type FieldDef = {
  key:
    | "title"
    | "oneLiner"
    | "problem"
    | "solution"
    | "targetMarket"
    | "businessModel"
    | "teamBackground"
    | "competitors"
    | "fundingStage"
    | "askAmount";
  label: string;
  required: boolean;
  max: number;
  placeholder?: string;
  textarea?: boolean;
};

const FIELDS: FieldDef[] = [
  { key: "title", label: "Idea title", required: true, max: 200, placeholder: "AI Legal Research" },
  { key: "oneLiner", label: "One-liner", required: true, max: 500, placeholder: "AI that helps law firms research cases 10x faster" },
  { key: "problem", label: "What problem does it solve?", required: true, max: 2000, textarea: true, placeholder: "Lawyers spend hours searching precedent across databases..." },
  { key: "solution", label: "What is your solution?", required: true, max: 2000, textarea: true, placeholder: "An AI agent that indexes case law and surfaces relevant precedent in seconds..." },
  { key: "targetMarket", label: "Target market", required: false, max: 1000, placeholder: "Mid-size US law firms, 20-200 attorneys" },
  { key: "businessModel", label: "Business model", required: false, max: 1000, placeholder: "SaaS subscription, $500/user/month" },
  { key: "teamBackground", label: "Team background", required: false, max: 1000, placeholder: "2 ex-lawyers + 1 ML engineer from Google" },
  { key: "competitors", label: "Competitors", required: false, max: 1000, placeholder: "LexisNexis, Westlaw, Casetext" },
  { key: "fundingStage", label: "Funding stage", required: false, max: 100, placeholder: "Pre-seed" },
  { key: "askAmount", label: "Ask amount", required: false, max: 100, placeholder: "$500k" },
];

type FieldKey = (typeof FIELDS)[number]["key"];

export default function NewEvaluationPage() {
  const router = useRouter();
  const [values, setValues] = useState<Record<FieldKey, string>>(() =>
    Object.fromEntries(FIELDS.map((f) => [f.key, ""])) as Record<FieldKey, string>
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function setField(key: FieldKey, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const payload: Record<string, string> = {};
    for (const f of FIELDS) {
      const val = values[f.key].trim();
      if (val) payload[f.key] = val;
    }

    const res = await fetch("/api/v1/idea-evaluations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body?.error?.message ?? "Something went wrong.");
      return;
    }

    const body = await res.json();
    router.push(`/dashboard/evaluate/${body.data.id}/interview`);
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link
          href="/dashboard/evaluate"
          className="text-[var(--color-text-low)] text-sm hover:text-[var(--color-teal)]"
        >
          ← Back to evaluations
        </Link>
      </div>

      <div className="mb-8">
        <div className="eyebrow">New evaluation</div>
        <h1 className="text-3xl font-semibold">Submit your idea</h1>
        <p className="text-[var(--color-text-mid)] text-sm mt-2">
          Fill in the basics. The committee will then interview you with up to
          25 questions before evaluating.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="panel-lg space-y-5">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label htmlFor={f.key} className="field-label">
              {f.label}
              {!f.required && (
                <span className="text-[var(--color-text-low)] normal-case ml-2">
                  (optional)
                </span>
              )}
            </label>
            {f.textarea ? (
              <textarea
                id={f.key}
                required={f.required}
                maxLength={f.max}
                rows={4}
                className="input resize-y"
                value={values[f.key]}
                onChange={(e) => setField(f.key, e.target.value)}
                placeholder={"placeholder" in f ? f.placeholder : ""}
              />
            ) : (
              <input
                id={f.key}
                type="text"
                required={f.required}
                maxLength={f.max}
                className="input"
                value={values[f.key]}
                onChange={(e) => setField(f.key, e.target.value)}
                placeholder={"placeholder" in f ? f.placeholder : ""}
              />
            )}
          </div>
        ))}

        {error && (
          <p className="text-[var(--color-coral)] text-sm">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full"
        >
          {loading ? "Starting interview…" : "Start interview"}
        </button>
      </form>
    </div>
  );
}