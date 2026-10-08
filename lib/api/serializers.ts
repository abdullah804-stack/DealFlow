/**
 * Shared serializers for API responses and server components.
 *
 * Two jobs:
 * 1. Convert Prisma results to JSON-safe plain objects (Dates → ISO strings,
 *    Decimal → number, etc.)
 * 2. Freeze the response shape so both server components and API routes
 *    return identical data.
 */

import type {
  Candidate,
  Dossier,
  CommitteeDecision,
  Report,
  DailyRun,
} from "@prisma/client";

// ═══════════════════════════════════════════════════════════════════
// JSON-safe type aliases
// ═══════════════════════════════════════════════════════════════════

export type CandidateJSON = Omit<
  Candidate,
  "firstSeen" | "updatedAt"
> & {
  firstSeen: string;
  updatedAt: string;
};

export type DossierJSON = Omit<Dossier, "createdAt" | "dossierJson"> & {
  createdAt: string;
  dossierJson: unknown;
};

export type CommitteeDecisionJSON = Omit<
  CommitteeDecision,
  "createdAt" | "round1Opinions" | "round2Opinions" | "roundComparison"
> & {
  createdAt: string;
  round1Opinions: unknown;
  round2Opinions: unknown;
  roundComparison: unknown;
};

export type ReportJSON = Omit<
  Report,
  "createdAt" | "reportJson"
> & {
  createdAt: string;
  reportJson: unknown;
};

export type DailyRunJSON = Omit<
  DailyRun,
  "startedAt" | "completedAt"
> & {
  startedAt: string;
  completedAt: string | null;
};

// ═══════════════════════════════════════════════════════════════════
// Serializers
// ═══════════════════════════════════════════════════════════════════

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

export function serializeCandidate(c: Candidate): CandidateJSON {
  return {
    ...c,
    firstSeen: c.firstSeen.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export function serializeDossier(d: Dossier): DossierJSON {
  return {
    ...d,
    createdAt: d.createdAt.toISOString(),
    dossierJson: d.dossierJson,
  };
}

export function serializeDecision(
  d: CommitteeDecision
): CommitteeDecisionJSON {
  return {
    ...d,
    createdAt: d.createdAt.toISOString(),
    round1Opinions: d.round1Opinions,
    round2Opinions: d.round2Opinions,
    roundComparison: d.roundComparison,
  };
}

export function serializeReport(r: Report): ReportJSON {
  return {
    ...r,
    createdAt: r.createdAt.toISOString(),
    reportJson: r.reportJson,
  };
}

export function serializeDailyRun(r: DailyRun): DailyRunJSON {
  return {
    ...r,
    startedAt: r.startedAt.toISOString(),
    completedAt: iso(r.completedAt),
  };
}

// ═══════════════════════════════════════════════════════════════════
// Composite shapes (used by dashboard + detail pages)
// ═══════════════════════════════════════════════════════════════════

export type CandidateDetailJSON = {
  candidate: CandidateJSON;
  dossier: DossierJSON | null;
  decision: CommitteeDecisionJSON | null;
  report: ReportJSON | null;
  assessments: Array<{
    id: string;
    agentType: string;
    round: number;
    score: number;
    confidence: number | null;
    summary: string | null;
    strengths: unknown;
    weaknesses: unknown;
    risks: unknown;
    unknowns: unknown;
    createdAt: string;
  }>;
};

export type FunnelStatsJSON = {
  discovered: number;
  validated: number;
  escalated: number;
  invested: number;
  periodDays: number;
};