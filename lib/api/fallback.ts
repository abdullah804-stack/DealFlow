/**
 * Fallback data for the dashboard when the database is empty.
 * Ported from the legacy frontend/app.js mock generators.
 */

export type FunnelData = {
  discovered: number;
  validated: number;
  escalated: number;
  invested: number;
  period_days: number;
};

export type ReportSummary = {
  id: string;
  company: string;
  decision: "INVEST" | "PASS";
  weighted_score: number;
  fast_path: boolean;
  timestamp: string;
  summary: string;
};

export function getEmptyFunnel(days: number): FunnelData {
  return {
    discovered: 0,
    validated: 0,
    escalated: 0,
    invested: 0,
    period_days: days,
  };
}

export function getEmptyReports(): ReportSummary[] {
  return [];
}