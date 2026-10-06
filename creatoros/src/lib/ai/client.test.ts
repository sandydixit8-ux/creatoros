import { describe, it, expect, afterEach, vi } from "vitest";
import { complete, extractJson, aiConfigured, AiUnavailableError } from "./client";

const ENV_KEYS = ["AI_API_KEY", "OPENAI_API_KEY", "AI_BASE_URL", "AI_MODEL"] as const;

afterEach(() => {
  for (const _k of ENV_KEYS) vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Runs complete(), which always rejects in these cases, and returns the Error. */
async function failure(promise: Promise<unknown>): Promise<Error> {
  return promise.then(
    () => {
      throw new Error("expected complete() to reject");
    },
    (e: unknown) => e as Error
  );
}

describe("aiConfigured", () => {
  it("is false with no key and true with either supported key", () => {
    expect(aiConfigured()).toBe(false);
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    expect(aiConfigured()).toBe(true);
  });

  it("prefers AI_API_KEY over OPENAI_API_KEY", async () => {
    vi.stubEnv("AI_API_KEY", "sk-primary");
    vi.stubEnv("OPENAI_API_KEY", "sk-fallback");

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await complete([{ role: "user", content: "hi" }]);
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer sk-primary");
  });

  // The old implementation cached the key in a module-level const, so this
  // assertion failed: aiConfigured() stayed false after a stub.
  it("re-reads env instead of caching a snapshot from import time", () => {
    expect(aiConfigured()).toBe(false);
    vi.stubEnv("AI_API_KEY", "sk-late");
    expect(aiConfigured()).toBe(true);
  });

  it("treats a base URL or model alone as not configured", () => {
    vi.stubEnv("AI_BASE_URL", "https://example.invalid/v1");
    vi.stubEnv("AI_MODEL", "some-model");
    expect(aiConfigured()).toBe(false);
  });
});

describe("complete", () => {
  it("throws a user-safe error when unconfigured, with no env var names in it", async () => {
    await expect(complete([{ role: "user", content: "hi" }])).rejects.toThrow(AiUnavailableError);

    // This message renders in the dashboard. It must not be a runbook that
    // tells an end user which env var to set.
    const err = await failure(complete([{ role: "user", content: "hi" }]));
    const text = err.message;
    expect(text).not.toMatch(/AI_API_KEY|OPENAI_API_KEY|\.env/i);
  });

  it("does not leak the upstream body or key when the provider errors", async () => {
    vi.stubEnv("AI_API_KEY", "sk-secret");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("invalid key sk-secret, prompt contained a@a.com", { status: 401 })
      )
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    const err = await failure(complete([{ role: "user", content: "hi" }]));
    expect(err.message).not.toMatch(/sk-secret|a@a\.com/);
    expect(err.message).toMatch(/try again/i);
  });

  it("reports a network failure without a provider body", async () => {
    vi.stubEnv("AI_API_KEY", "sk-test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("getaddrinfo ENOTFOUND api.openai.com"))
    );

    const err = await failure(complete([{ role: "user", content: "hi" }]));
    expect(err.message).toMatch(/could not reach/i);
    expect(err.message).not.toMatch(/enotfound/i);
  });

  it("strips a trailing slash from the base url", async () => {
    vi.stubEnv("AI_API_KEY", "sk-test");
    vi.stubEnv("AI_BASE_URL", "https://example.invalid/v1/");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await complete([{ role: "user", content: "hi" }]);
    expect(fetchMock.mock.calls[0][0]).toBe("https://example.invalid/v1/chat/completions");
  });
});

describe("extractJson", () => {
  it("parses raw JSON", () => {
    expect(extractJson('{"score":80}')).toEqual({ score: 80 });
  });

  it("parses fenced JSON, which models emit despite instructions", () => {
    expect(extractJson('```json\n{"score":80}\n```')).toEqual({ score: 80 });
    expect(extractJson('```\n{"score":80}\n```')).toEqual({ score: 80 });
  });

  it("finds an object embedded in surrounding prose", () => {
    expect(extractJson('Here you go: {"score":42} — hope that helps.')).toEqual({ score: 42 });
  });

  it("throws when there is no object at all", () => {
    expect(() => extractJson("I could not analyze your data.")).toThrow();
  });
});
