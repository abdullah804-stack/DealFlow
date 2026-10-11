import { prisma } from "@/lib/prisma";

/**
 * Logs every LLM call to the agent_run_logs table.
 *
 * Called by lib/ai/client.ts after each successful or failed call.
 * Non-blocking: any logging failure is swallowed so that the actual
 * LLM flow is never broken by a logging issue.
 */

export type LLMCallLog = {
  agentType: string;
  model: string;
  promptTokens: number;
  outputTokens: number;
  durationMs: number;
  status: "ok" | "failed_retryable" | "failed_fatal";
  errorMessage?: string;
};

export async function logLLMCall(entry: LLMCallLog): Promise<void> {
  try {
    await prisma.agentRunLog.create({
      data: {
        agentType: entry.agentType,
        modelName: entry.model,
        promptTokens: entry.promptTokens,
        outputTokens: entry.outputTokens,
        durationMs: entry.durationMs,
        status: entry.status,
        errorMessage: entry.errorMessage ?? null,
      },
    });
  } catch {
    // Logging must never break the LLM call path.
  }
}

// ─── In-process counter for the current request ────────────────────
//
// We can't pass a mutable counter through the whole LLM chain easily,
// so we use a module-level accumulator that the committee resets at the
// start of a run and reads at the end.

let runCallCount = 0;

export function resetLLMCount(): void {
  runCallCount = 0;
}

export function incrementLLMCount(): void {
  runCallCount += 1;
}

export function getLLMCount(): number {
  return runCallCount;
}