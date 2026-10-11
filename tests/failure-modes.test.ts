import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { stripJsonFence } from "@/lib/ai/client";
import { AgentAssessmentSchema } from "@/lib/agents/contracts";
import { AnswerSchema } from "@/lib/interview/schema";
import { aggregateScores } from "@/lib/agents/voting";
import { canonicalKey } from "@/lib/utils/canonical-key";

// ═══════════════════════════════════════════════════════════════════
// 1. Malformed LLM JSON is repaired or rejected cleanly
// ═══════════════════════════════════════════════════════════════════

describe("failure mode 1: malformed LLM JSON", () => {
  it("strips markdown fences from wrapped JSON", () => {
    const wrapped = '```json\n{"ok": true}\n```';
    const cleaned = stripJsonFence(wrapped);
    expect(cleaned).toBe('{"ok": true}');
    expect(() => JSON.parse(cleaned)).not.toThrow();
  });

  it("extracts JSON from surrounding prose", () => {
    const prose = 'Here is the JSON: {"a": 1} — hope that helps!';
    const cleaned = stripJsonFence(prose);
    expect(cleaned).toBe('{"a": 1}');
  });

  it("rejects assessment that fails Zod validation", () => {
    const bad = {
      agentType: "technical",
      score: 15, // out of range
      summary: "short", // too short (min 20)
      strengths: [],
      weaknesses: [],
      risks: [],
      assumptions: [],
      evidenceIds: [],
      unknowns: [],
      recommendedActions: [],
      confidence: "high",
    };
    const parsed = AgentAssessmentSchema.safeParse(bad);
    expect(parsed.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. Interview answer length is capped
// ═══════════════════════════════════════════════════════════════════

describe("failure mode 2: interview answer length cap", () => {
  it("rejects answers over 2000 chars", () => {
    const huge = "x".repeat(2001);
    const parsed = AnswerSchema.safeParse({
      turnIndex: 0,
      answerText: huge,
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts answers under 2000 chars", () => {
    const fine = "x".repeat(500);
    const parsed = AnswerSchema.safeParse({
      turnIndex: 0,
      answerText: fine,
    });
    expect(parsed.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. Voting handles edge cases without crashing
// ═══════════════════════════════════════════════════════════════════

describe("failure mode 3: voting edge cases", () => {
  it("handles empty assessments", () => {
    const r = aggregateScores([]);
    expect(r.weightedTotal).toBe(0);
    expect(r.decision).toBe("PASS");
    expect(r.isFastPath).toBe(false);
  });

  it("clamps out-of-range scores", () => {
    const r = aggregateScores([
      {
        agentType: "technical",
        score: 999,
        summary: "Test summary that meets the minimum length requirement.",
        strengths: [],
        weaknesses: [],
        risks: [],
        assumptions: [],
        evidenceIds: [],
        unknowns: [],
        recommendedActions: [],
        confidence: "high",
      },
    ]);
    // Should not throw, should clamp internally
    expect(r.weightedTotal).toBeLessThanOrEqual(10);
    expect(r.weightedTotal).toBeGreaterThanOrEqual(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. Canonical key normalization
// ═══════════════════════════════════════════════════════════════════

describe("failure mode 4: canonical key dedup", () => {
  it("normalizes URLs with different protocols to the same key", () => {
    const a = canonicalKey("https://acme.io/pricing");
    const b = canonicalKey("http://www.acme.io/");
    expect(a).toBe(b);
    expect(a).toBe("acme.io");
  });

  it("handles missing protocol", () => {
    expect(canonicalKey("acme.io")).toBe("acme.io");
  });

  it("falls back to source:sourceId when no domain", () => {
    const k = canonicalKey("", "reddit_r/startups", "abc123");
    expect(k).toBe("reddit_r/startups:abc123");
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5. Zod rejects malformed intake
// ═══════════════════════════════════════════════════════════════════

describe("failure mode 5: malformed intake rejected", () => {
  const IntakeSchema = z.object({
    title: z.string().min(3).max(200),
    oneLiner: z.string().min(10).max(500),
    problem: z.string().min(20).max(2000),
    solution: z.string().min(20).max(2000),
  });

  it("rejects title under 3 chars", () => {
    const parsed = IntakeSchema.safeParse({
      title: "ab",
      oneLiner: "This is a one-liner description.",
      problem: "This is a sufficiently long problem statement that passes.",
      solution: "This is a sufficiently long solution statement that passes.",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts well-formed intake", () => {
    const parsed = IntakeSchema.safeParse({
      title: "AI Meeting Notes",
      oneLiner: "Transcribes and summarizes meetings.",
      problem: "Teams waste hours on manual notes and forget action items.",
      solution: "AI agent joins calls and extracts action items automatically.",
    });
    expect(parsed.success).toBe(true);
  });
});