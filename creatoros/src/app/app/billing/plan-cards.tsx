"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { loadCashfree } from "@/lib/payments/cashfree-checkout";

export interface PlanCardData {
  key: string;
  active: boolean;
  priceInr: number;
  priceUsd: number;
  limits: {
    bioPages: number;
    links: number;
    contacts: number;
    services: number;
    customDomain: boolean;
    emailAutomation: boolean;
  };
}

function loadCashfront(mode: "sandbox" | "production") {
  return loadCashfree(mode);
}

/** Cashfree wants a 10-digit Indian mobile for domestic mandates. */
function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return null;
}

/**
 * Cashfree returns no hosted redirect URL for mandates, so upgrades run through
 * Cashfront's subscription checkout in the browser. The phone number is shared
 * across every plan here rather than repeated per card, and validated before any
 * request so a missing number never reaches the server.
 */
export default function PlanCards({
  plans,
  mode,
  needsPhone,
  showPriceInr,
}: {
  plans: PlanCardData[];
  mode: "sandbox" | "production";
  needsPhone: boolean;
  showPriceInr: boolean;
}) {
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function start(plan: string) {
    if (busyPlan) return;
    setError("");

    let customerPhone = "";
    if (needsPhone) {
      const normalised = normalisePhone(phone);
      if (!normalised) {
        setPhoneError("Enter your 10-digit mobile number");
        return;
      }
      setPhoneError("");
      customerPhone = normalised;
    }

    setBusyPlan(plan);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, phone: customerPhone }),
      });
      const payload = (await res.json().catch(() => null)) as
        | { ok: true; data: { provider: string; sessionId: string | null; url: string | null } }
        | { ok: false; error: { message: string; details?: Record<string, string[]> } }
        | null;

      if (!payload) throw new Error("Something went wrong. Please try again.");
      if (!payload.ok) {
        const first = payload.error.details ? Object.values(payload.error.details).flat()[0] : undefined;
        // Field-level validation errors belong next to the field, not the card.
        if (first && payload.error.message === "Validation failed") {
          if (first.toLowerCase().includes("phone")) {
            setPhoneError(first);
            setBusyPlan(null);
            return;
          }
          setError(first);
        } else {
          setError(first || payload.error.message);
        }
        setBusyPlan(null);
        return;
      }

      const { provider, sessionId, url } = payload.data;

      if (provider === "cashfree" && sessionId) {
        const cashfree = await loadCashfront(mode);
        if (!cashfree.subscriptionsCheckout) throw new Error("Cashfree checkout could not start. Please try again.");
        const result = await cashfree.subscriptionsCheckout({
          subsSessionId: sessionId,
          redirectTarget: "_self",
        });
        if (result?.error) throw new Error(result.error.message || "Checkout was closed");
        return;
      }

      if (url) {
        window.location.assign(url);
        return;
      }

      throw new Error("Checkout is unavailable right now");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      setBusyPlan(null);
    }
  }

  return (
    <div className="space-y-4">
      {needsPhone && (
        <div className="card p-4">
          <label htmlFor="mandate-phone" className="text-sm font-medium text-navy-800">
            Mobile number for your mandate
          </label>
          <p className="mt-0.5 text-xs text-navy-500">
            UPI and card mandates are authorised against this number, so it must match your bank records.
          </p>
          <input
            id="mandate-phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            maxLength={13}
            placeholder="98765 43210"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              if (phoneError) setPhoneError("");
            }}
            className={`mt-2 w-full rounded-lg border px-3 py-2 text-sm text-navy-900 placeholder:text-navy-400 focus:outline-none sm:max-w-xs ${
              phoneError ? "border-red-300 focus:border-red-400" : "border-navy-200 focus:border-brand-400"
            }`}
            aria-invalid={phoneError ? true : undefined}
            aria-describedby={phoneError ? "mandate-phone-error" : undefined}
          />
          {phoneError && (
            <p id="mandate-phone-error" className="mt-1.5 text-xs text-red-600">
              {phoneError}
            </p>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {plans.map((p) => {
          const l = p.limits;
          return (
            <div
              key={p.key}
              className={`card flex flex-col p-5 ${p.active ? "border-brand-400 ring-1 ring-brand-300" : ""}`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold capitalize text-navy-900">{p.key}</h3>
                {p.active && (
                  <span className="rounded-full bg-brand-600 px-2 py-0.5 text-xs font-medium text-white">Current</span>
                )}
              </div>
              <div className="mt-2 text-xl font-bold text-navy-950">
                {showPriceInr ? `₹${p.priceInr}` : `$${p.priceUsd}`}
                <span className="text-xs font-medium text-navy-400">/mo</span>
              </div>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-navy-600">
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" /> {f(l.bioPages)} bio pages
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" /> {f(l.links)} links
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" /> {f(l.contacts)} contacts
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" /> {f(l.services)} booking services
                </li>
                {l.customDomain && (
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" /> Custom domain
                  </li>
                )}
                {l.emailAutomation && (
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" /> Email automation
                  </li>
                )}
              </ul>
              {!p.active && (
                <button
                  type="button"
                  onClick={() => start(p.key)}
                  disabled={busyPlan !== null}
                  className="btn-secondary mt-5 w-full disabled:opacity-60"
                >
                  {busyPlan === p.key ? "Starting checkout…" : busyPlan ? "Please wait…" : "Upgrade"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

function f(n: number): string {
  return n === -1 ? "Unlimited" : String(n);
}
