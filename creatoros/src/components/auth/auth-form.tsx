"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [mfaToken, setMfaToken] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (mode === "register" && !agreed) {
      setError("Please accept the Terms of Service and Privacy Policy to continue.");
      return;
    }
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const body = Object.fromEntries(form.entries());

    try {
      if (mfaToken) {
        const res = await fetch("/api/auth/login/mfa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mfaToken, code: body.code }),
        });
        const json = await res.json();
        if (!json.ok) {
          if (json.error?.code === "mfa_expired") setMfaToken(null);
          setError(json.error?.message || "Invalid code. Try again.");
          setLoading(false);
          return;
        }
        router.push("/app");
        router.refresh();
        return;
      }

      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error?.message || "Something went wrong");
        setLoading(false);
        return;
      }
      if (json.data?.mfaRequired) {
        setMfaToken(String(json.data.mfaToken));
        setLoading(false);
        return;
      }
      router.push("/app");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  if (mfaToken) {
    return (
      <form onSubmit={onSubmit} className="space-y-4">
        <p className="text-sm text-navy-600">Enter the 6-digit code from your authenticator app, or a backup code.</p>
        <div>
          <label className="label" htmlFor="code">Authentication code</label>
          <input
            id="code"
            name="code"
            required
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={16}
            className="input text-center tracking-[0.3em]"
            placeholder="123456"
          />
        </div>
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify and log in"}
        </button>
        <button
          type="button"
          onClick={() => {
            setMfaToken(null);
            setError("");
          }}
          className="w-full text-center text-xs text-navy-500 hover:text-navy-700"
        >
          Back to password
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required className="input" placeholder="you@example.com" />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required minLength={8} className="input" placeholder="At least 8 characters" />
      </div>
      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "login" ? "Log in" : "Create account"}
      </button>
      {mode === "register" && (
        <div className="space-y-3">
          <label className="flex items-start gap-2 text-xs text-navy-600">
            <input
              id="agree"
              name="agree"
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              I agree to the{" "}
              <Link href="/terms" target="_blank" className="font-medium text-brand-600 hover:text-brand-700">Terms of Service</Link>
              {" "}and{" "}
              <Link href="/privacy" target="_blank" className="font-medium text-brand-600 hover:text-brand-700">Privacy Policy</Link>.
            </span>
          </label>
          <p className="text-xs text-navy-500">
            We keep your data secure and request consent before storing any contact information.
          </p>
        </div>
      )}
    </form>
  );
}
