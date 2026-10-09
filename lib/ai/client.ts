/**
 * LLM client for TypeScript — port of src/llm/client.py.
 *
 * Primary: Groq (llama/qwen models)
 * Fallback: OpenRouter (nemotron, etc.)
 *
 * All calls go through here. Zod validation happens at the caller, not
 * in this module, because each call site has its own response schema.
 */

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
};

async function callOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  opts: CallOptions
): Promise<string> {
  const maxRetries = opts.retries ?? 2;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
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
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("Empty response from LLM");
      return content.trim();
    } catch (e) {
      lastError = e;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
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
    for (const [open, close] of [["{", "}"], ["[", "]"]] as const) {
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

  // Groq primary
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
    // fall through
  }

  // OpenRouter fallback
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
  // Groq requires the literal word "json" in messages when response_format=json_object
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