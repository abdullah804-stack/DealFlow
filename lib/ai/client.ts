/**
 * LLM client for TypeScript — port of src/llm/client.py.
 *
 * Primary: Groq (qwen/qwen3.8-27b)
 * Fallback: OpenRouter (nvidia/nemotron-3-super-120b-a12b:free)
 *
 * All calls go through here. Zod validation happens at the caller, not
 * in this module, because each call site has its own response schema.
 *
 * On 429 responses, honors the provider's Retry-After header.
 * Falls back to exponential backoff with jitter otherwise.
 */

import { logLLMCall, incrementLLMCount } from "./cost-tracker";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

const GROQ_MODEL = process.env.GROQ_MODEL ?? "qwen/qwen3.8-27b";
const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL ?? "nvidia/nemotron-3-super-120b-a12b:free";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type CallOptions = {
  temperature?: number;
  maxTokens?: number;
  retries?: number;
  responseFormat?: "json_object" | "text";
  agentType?: string;
};

class HTTPError extends Error {
  retryAfterMs: number | null;
  status: number;

  constructor(message: string, status: number, retryAfterMs: number | null) {
    super(message);
    this.name = "HTTPError";
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const asSeconds = parseFloat(header);
  if (Number.isFinite(asSeconds)) return Math.ceil(asSeconds * 1000);
  const asDate = Date.parse(header);
  if (Number.isFinite(asDate)) return Math.max(0, asDate - Date.now());
  return null;
}

async function callOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  opts: CallOptions
): Promise<string> {
  const maxRetries = opts.retries ?? 2;
  const agentType = opts.agentType ?? "unknown";
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const start = Date.now();

    try {
      const body: Record<string, unknown> = {
        model,
        messages,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? 2048,
      };
      if (opts.responseFormat === "json_object") {
        body.response_format = { type: "json_object" };
      }

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new HTTPError(
          `HTTP ${res.status}: ${text.slice(0, 200)}`,
          res.status,
          parseRetryAfter(res.headers.get("retry-after"))
        );
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("Empty response from LLM");

      const durationMs = Date.now() - start;

      void logLLMCall({
        agentType,
        model,
        promptTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
        durationMs,
        status: "ok",
      });
      incrementLLMCount();

      return content.trim();
    } catch (e) {
      lastError = e;
      const durationMs = Date.now() - start;

      if (attempt < maxRetries) {
        let waitMs: number;

        if (e instanceof HTTPError && e.retryAfterMs != null && e.retryAfterMs > 0) {
          waitMs = Math.min(e.retryAfterMs, 45_000);
        } else {
          const base = 1000 * 2 ** attempt;
          const jitter = Math.floor(Math.random() * 500);
          waitMs = Math.min(base + jitter, 20_000);
        }

        await new Promise((r) => setTimeout(r, waitMs));
      } else {
        void logLLMCall({
          agentType,
          model,
          promptTokens: 0,
          outputTokens: 0,
          durationMs,
          status: "failed_fatal",
          errorMessage:
            e instanceof Error ? e.message.slice(0, 500) : "unknown",
        });
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/**
 * Strip markdown code fences that LLMs sometimes wrap JSON in.
 * Ported from src/llm/client.py::_strip_json_fence.
 */
export function stripJsonFence(text: string): string {
  let s = text.trim();

  if (s.startsWith("```")) {
    const nl = s.indexOf("\n");
    if (nl !== -1) {
      s = s.slice(nl + 1);
    } else {
      s = s.replace(/^`+/, "");
      if (s.toLowerCase().startsWith("json")) s = s.slice(4);
    }
  }

  if (s.trimEnd().endsWith("```")) {
    s = s.trimEnd().slice(0, -3);
  }

  s = s.trim();

  if (s && !s.startsWith("{") && !s.startsWith("[")) {
    for (const [open, close] of [
      ["{", "}"],
      ["[", "]"],
    ] as const) {
      const start = s.indexOf(open);
      const end = s.lastIndexOf(close);
      if (start !== -1 && end > start) {
        s = s.slice(start, end + 1);
        break;
      }
    }
  }

  return s.trim();
}

/**
 * Call an LLM and return the raw text response.
 * Groq primary, OpenRouter fallback.
 */
export async function callLLM(
  prompt: string,
  systemPrompt?: string,
  opts: CallOptions = {}
): Promise<string> {
  const messages: ChatMessage[] = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: prompt });

  try {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) throw new Error("GROQ_API_KEY not set");
    return await callOpenAICompatible(
      GROQ_BASE_URL,
      groqKey,
      GROQ_MODEL,
      messages,
      opts
    );
  } catch {
    // fall through to OpenRouter
  }

  const orKey = process.env.OPENROUTER_API_KEY;
  if (!orKey) throw new Error("OPENROUTER_API_KEY not set");
  return await callOpenAICompatible(
    OPENROUTER_BASE_URL,
    orKey,
    OPENROUTER_MODEL,
    messages,
    opts
  );
}

/**
 * Call an LLM and parse the response as JSON.
 * Strips markdown fences automatically.
 */
export async function callLLMJson(
  prompt: string,
  systemPrompt?: string,
  opts: CallOptions = {}
): Promise<Record<string, unknown>> {
  const safeSystem =
    systemPrompt && !systemPrompt.toLowerCase().includes("json")
      ? `${systemPrompt}\n\nRespond with valid json only.`
      : systemPrompt;

  const raw = await callLLM(prompt, safeSystem, {
    ...opts,
    responseFormat: "json_object",
  });
  const cleaned = stripJsonFence(raw);
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch (e) {
    throw new Error(`LLM response is not valid JSON: ${e}`);
  }
}