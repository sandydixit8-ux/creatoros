/**
 * OpenAI-compatible chat client.
 *
 * Env is read through functions rather than module-level `const` so that a
 * test (or any future runtime reconfiguration) sees the current value rather
 * than a snapshot frozen at import time. The previous version cached the key in
 * a `const`, which meant `vi.stubEnv` after import had no effect and a config
 * change required a process restart to be visible to `aiConfigured()`.
 */

export interface AiConfig {
  baseUrl: string;
  model: string;
  key: string;
}

function readConfig(): AiConfig {
  return {
    baseUrl: (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, ""),
    model: process.env.AI_MODEL || "gpt-4o-mini",
    key: process.env.AI_API_KEY || process.env.OPENAI_API_KEY || "",
  };
}

/** True when a provider key is present. Only the key gates this: base URL and model have defaults. */
export function aiConfigured(): boolean {
  return Boolean(readConfig().key);
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiResponse {
  text: string;
  usage?: { prompt: number; completion: number; total: number };
}

export class AiUnavailableError extends Error {
  constructor() {
    // Deliberately says nothing about which env var to set or that a .env file
    // is involved. This string reaches end users in the UI, so it must not be an
    // operator runbook.
    super("AI Coach is unavailable right now. Please try again later or contact support.");
    this.name = "AiUnavailableError";
  }
}

export async function complete(
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number } = {}
): Promise<AiResponse> {
  const cfg = readConfig();
  if (!cfg.key) throw new AiUnavailableError();

  let res: Response;
  try {
    res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.key}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        temperature: opts.temperature ?? 0.4,
        max_tokens: opts.maxTokens ?? 1200,
      }),
    });
  } catch {
    // Network/DNS/TLS failure. The provider's own body never arrived, so there
    // is nothing to add and no key material to leak.
    throw new Error("Could not reach the AI provider. Please try again.");
  }

  if (!res.ok) {
    // Log the provider's raw response server-side for diagnosis, but throw a
    // generic message. Upstream bodies can echo the Authorization header or the
    // submitted prompt (which includes the tenant's leads and customer emails).
    console.error(`[ai] provider responded ${res.status}`, (await res.text().catch(() => "")).slice(0, 500));
    throw new Error("The AI provider returned an error. Please try again.");
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };
  const text = data.choices?.[0]?.message?.content?.trim() || "";
  return {
    text,
    usage: data.usage
      ? {
          prompt: data.usage.prompt_tokens ?? 0,
          completion: data.usage.completion_tokens ?? 0,
          total: data.usage.total_tokens ?? 0,
        }
      : undefined,
  };
}

/**
 * Strip markdown code fences from an AI response that should be raw JSON.
 *
 * The coach route uses this rather than a bare `JSON.parse`, because models
 * routinely wrap JSON in ```json fences even when told not to, and a parse
 * failure there would surface as a generic error to a paying user.
 */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("AI response did not contain a JSON object");
  return JSON.parse(candidate.slice(start, end + 1));
}
