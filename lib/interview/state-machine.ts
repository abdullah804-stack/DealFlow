import type { IdeaEvaluationStatus } from "./schema";
import { TOTAL_QUESTIONS, REQUIRED_QUESTIONS } from "./questions";

/**
 * Interview state machine — pure transition logic.
 *
 * The evaluation lifecycle:
 *   intake → interviewing → review → evaluating → complete
 *                                            ↘ failed_partial
 *
 * The interview session lifecycle (nested inside evaluation):
 *   interviewing → review → complete
 *
 * Every transition has a validator here. If a transition is not permitted,
 * the API route returns 409 (conflict). No route should ever write a status
 * that hasn't passed through this module.
 */

// ═══════════════════════════════════════════════════════════════════
// EVALUATION LIFECYCLE
// ═══════════════════════════════════════════════════════════════════

const ALLOWED_TRANSITIONS: Record<
  IdeaEvaluationStatus,
  IdeaEvaluationStatus[]
> = {
  intake: ["interviewing"],
  interviewing: ["review", "failed_partial"],
  review: ["interviewing", "evaluating"],
  evaluating: ["complete", "failed_partial"],
  complete: [],
  failed_partial: ["evaluating"],
};

export function canTransition(
  from: IdeaEvaluationStatus,
  to: IdeaEvaluationStatus
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(
  from: IdeaEvaluationStatus,
  to: IdeaEvaluationStatus
): void {
  if (!canTransition(from, to)) {
    throw new StateTransitionError(from, to);
  }
}

export class StateTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Invalid state transition: ${from} → ${to}`);
    this.name = "StateTransitionError";
  }
}

// ═══════════════════════════════════════════════════════════════════
// INTERVIEW COMPLETION LOGIC
// ═══════════════════════════════════════════════════════════════════

export type InterviewProgress = {
  total: number;
  answered: number;
  skipped: number;
  requiredAnswered: number;
  isComplete: boolean;
};

/**
 * Given a list of turns for a session, determine whether the interview is
 * complete. The rules:
 *
 * - Every one of the 20 required questions must have a non-empty answer
 * - Skipped questions count as "not answered" but do not block if the
 *   question was not required
 * - The interview auto-completes when all required questions are answered
 *   and the caller has asked at least TOTAL_QUESTIONS - SKIPPABLE or the
 *   user has explicitly skipped the remaining optional ones
 */
export function evaluateProgress(
  turns: Array<{
    questionKey: string;
    answerText: string | null;
    skipped: boolean;
  }>,
  requiredKeys: Set<string>
): InterviewProgress {
  const answered = turns.filter(
    (t) => t.answerText && t.answerText.trim().length > 0
  ).length;
  const skipped = turns.filter((t) => t.skipped).length;

  const answeredKeys = new Set(
    turns
      .filter((t) => t.answerText && t.answerText.trim().length > 0)
      .map((t) => t.questionKey)
  );

  const requiredAnswered = Array.from(requiredKeys).filter((k) =>
    answeredKeys.has(k)
  ).length;

  const isComplete = requiredAnswered === requiredKeys.size;

  return {
    total: TOTAL_QUESTIONS,
    answered,
    skipped,
    requiredAnswered,
    isComplete,
  };
}

// ═══════════════════════════════════════════════════════════════════
// HARD CAPS (enforced in code, not the LLM)
// ═══════════════════════════════════════════════════════════════════

export const HARD_CAPS = {
  /** 5 core questions per specialist */
  maxQuestionsPerSpecialist: 5,
  /** 1 clarification allowed per core question */
  maxClarificationsPerQuestion: 1,
  /** 25 total questions */
  maxTotalQuestions: TOTAL_QUESTIONS,
  /** user answers capped at 2000 chars */
  maxAnswerLength: 2000,
  /** intake form has 10 fields */
  maxIntakeFields: 10,
  /** required questions cannot be skipped */
  requiredQuestions: REQUIRED_QUESTIONS,
} as const;

export function validateAnswerLength(text: string): void {
  if (text.length > HARD_CAPS.maxAnswerLength) {
    throw new Error(
      `Answer exceeds ${HARD_CAPS.maxAnswerLength} character limit`
    );
  }
}

// ═══════════════════════════════════════════════════════════════════
// NEXT QUESTION SELECTION (pure — no LLM)
// ═══════════════════════════════════════════════════════════════════

/**
 * Given all turns so far, return the set of question keys that have not
 * yet been asked. The turn generator uses this list to pick the next one.
 */
export function unaskedQuestionKeys(
  askedKeys: Set<string>,
  allKeys: string[]
): string[] {
  return allKeys.filter((k) => !askedKeys.has(k));
}

/**
 * Count how many questions each specialist has been asked. Used to enforce
 * the 5-per-specialist cap.
 */
export function specialistQuestionCounts(
  turns: Array<{ specialist: string }>
): Record<string, number> {
  return turns.reduce<Record<string, number>>((acc, t) => {
    acc[t.specialist] = (acc[t.specialist] ?? 0) + 1;
    return acc;
  }, {});
}

export function canAskMoreForSpecialist(
  specialist: string,
  turns: Array<{ specialist: string }>
): boolean {
  const counts = specialistQuestionCounts(turns);
  return (counts[specialist] ?? 0) < HARD_CAPS.maxQuestionsPerSpecialist;
}