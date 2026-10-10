/**
 * Rubric V1 — locked.
 * Mirrors config/settings.py INVESTOR_WEIGHTS, INVESTMENT_THRESHOLD,
 * FAST_PATH_CONSENSUS_HIGH, FAST_PATH_CONSENSUS_LOW.
 *
 * Any change here MUST be mirrored in config/settings.py. The two
 * files must produce identical numeric output for identical input.
 */

export const RUBRIC_V1 = {
  version: "1.0",

  weights: {
    technical: 0.25,
    finance: 0.25,
    marketing: 0.2,
    legal: 0.1,
    founder: 0.2,
  } as const,

  thresholds: {
    fastPathConsensusHigh: 8.5,
    fastPathConsensusLow: 3.0,
    invest: 6.5,
    pass: 4.0,
  } as const,

  insufficientEvidence: {
    minUnknownsPerAgent: 3,
    minAgentsWithUnknowns: 3,
  } as const,

  // Keywords marking an "unknown" as critical for the insufficient-evidence check.
  // Deliberately lowercase; comparison is case-insensitive.
  criticalUnknownKeywords: [
    "finance",
    "pricing",
    "feasibility",
    "customer",
    "market",
    "traction",
  ],
} as const;

export type Rubric = typeof RUBRIC_V1;