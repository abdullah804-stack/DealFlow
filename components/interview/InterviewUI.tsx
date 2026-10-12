"use client";

import Image from "next/image";
import Link from "next/link";

export const SPECIALIST_ORDER = [
  "technical",
  "finance",
  "marketing",
  "legal",
  "founder",
] as const;

export type SpecialistKey = (typeof SPECIALIST_ORDER)[number];

export const SPECIALIST_META: Record<
  SpecialistKey,
  { name: string; title: string; image: string }
> = {
  technical: {
    name: "Aris Bahri",
    title: "Technical Agent",
    image: "/agents/technical.png",
  },
  finance: {
    name: "Amara Okafor",
    title: "Finance Agent",
    image: "/agents/finance.png",
  },
  marketing: {
    name: "Rohan Mehta",
    title: "Marketing Agent",
    image: "/agents/marketing.png",
  },
  legal: {
    name: "Mei Tanaka",
    title: "Legal Agent",
    image: "/agents/legal.png",
  },
  founder: {
    name: "Karim Haddad",
    title: "Founder Agent",
    image: "/agents/founder.png",
  },
};

export type SpecialistProgressEntry = {
  answered: number;
  total: number;
  complete: boolean;
};

export type SpecialistProgress = Record<
  SpecialistKey,
  SpecialistProgressEntry
>;

// ─── Progress strip ────────────────────────────────────────────────

export function ProgressStrip({
  evaluationId,
  currentSpecialist,
  progress,
}: {
  evaluationId: string;
  currentSpecialist: SpecialistKey;
  progress: SpecialistProgress | null;
}) {
  return (
    <div className="flex items-center justify-center gap-2 md:gap-4 mb-8 flex-wrap">
      {SPECIALIST_ORDER.map((key, i) => {
        const meta = SPECIALIST_META[key];
        const entry = progress?.[key];
        const isCurrent = key === currentSpecialist;
        const isDone = entry?.complete ?? false;

        return (
          <div key={key} className="flex items-center gap-2 md:gap-4">
            <Link
              href={
                isDone || i === 0 || SPECIALIST_ORDER.indexOf(currentSpecialist) > i
                  ? `/dashboard/evaluate/${evaluationId}/interview/${key}`
                  : "#"
              }
              className={`flex items-center gap-2 px-3 py-2 rounded-md border transition-all text-xs md:text-sm ${
                isCurrent
                  ? "border-[var(--color-neon)] bg-[var(--color-panel)] text-[var(--color-text-hi)]"
                  : isDone
                  ? "border-[var(--color-border)] text-[var(--color-text-mid)] hover:border-[var(--color-neon)]"
                  : "border-[var(--color-border-soft)] text-[var(--color-text-low)] cursor-not-allowed"
              }`}
              aria-disabled={!isDone && !isCurrent}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isDone
                    ? "bg-[var(--color-neon)]"
                    : isCurrent
                    ? "bg-[var(--color-neon)] animate-pulse"
                    : "bg-[var(--color-border)]"
                }`}
              />
              <span className="capitalize hidden md:inline">{key}</span>
              <span className="font-mono text-[10px] opacity-60">
                {entry ? `${entry.answered}/${entry.total || 5}` : "0/5"}
              </span>
            </Link>
            {i < SPECIALIST_ORDER.length - 1 && (
              <span className="text-[var(--color-border)] hidden md:inline">
                →
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Agent sidebar ────────────────────────────────────────────────

export function AgentSidebar({
  specialist,
  questionIndex,
  totalQuestions,
}: {
  specialist: SpecialistKey;
  questionIndex: number;
  totalQuestions: number;
}) {
  const meta = SPECIALIST_META[specialist];

  return (
    <div className="panel-lg !p-0 overflow-hidden flex flex-col">
      <div className="relative w-full aspect-[3/4] bg-[var(--color-bg-raise)]">
        <Image
          src={meta.image}
          alt={meta.name}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-contain object-bottom"
          priority
        />
      </div>
      <div className="p-5 text-center border-t border-[var(--color-border-soft)]">
        <div className="font-semibold text-[15px] mb-1">{meta.name}</div>
        <div className="font-mono text-[10px] text-[var(--color-text-low)] uppercase tracking-wider mb-3">
          {meta.title}
        </div>
        <div className="font-mono text-xs text-[var(--color-neon)]">
          Question {questionIndex} of {totalQuestions}
        </div>
      </div>
    </div>
  );
}

// ─── Question card ────────────────────────────────────────────────

export function QuestionCard({
  questionText,
  specialist,
  questionIndex,
  totalQuestions,
}: {
  questionText: string;
  specialist: SpecialistKey;
  questionIndex: number;
  totalQuestions: number;
}) {
  const meta = SPECIALIST_META[specialist];

  return (
    <div className="panel-lg fade-in" key={questionText}>
      <div className="flex items-center justify-between mb-5">
        <div className="eyebrow mb-0">
          {meta.title.replace(" Agent", "")} question {questionIndex} of {totalQuestions}
        </div>
      </div>
      <p className="text-[var(--color-text-hi)] text-lg md:text-xl leading-relaxed">
        {questionText}
      </p>
    </div>
  );
}