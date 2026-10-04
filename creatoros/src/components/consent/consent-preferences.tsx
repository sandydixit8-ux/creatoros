"use client";

import { useConsent } from "@/lib/use-consent";

/**
 * Consent controls embedded in the Cookie Policy (D-5).
 *
 * The policy promises consent can be "withdrawn at any time", so the policy page
 * itself has to be where withdrawal happens - not only inside a first-visit
 * banner a returning visitor never sees again.
 */
export function ConsentPreferences() {
  const { ready, record, analyticsAllowed, setAnalytics, withdraw, rejectAll } = useConsent();

  return (
    <section
      aria-label="Your cookie preferences"
      data-testid="consent-preferences"
      className="rounded-2xl border border-navy-100 bg-navy-50/60 p-5"
    >
      <h2 className="text-base font-bold text-navy-900">Your cookie preferences</h2>

      {!ready ? (
        <p className="mt-2 text-sm text-navy-600">Loading your preferences...</p>
      ) : record === null ? (
        <p className="mt-2 text-sm text-navy-600" data-testid="consent-undecided">
          You have not made a choice yet, so only strictly necessary cookies are in use.
        </p>
      ) : (
        <p className="mt-2 text-sm text-navy-600" data-testid="consent-summary">
          Analytics is currently <strong>{analyticsAllowed ? "allowed" : "not allowed"}</strong>.
          Your choice was recorded on {new Date(record.decidedAt).toLocaleDateString("en-GB")}.
        </p>
      )}

      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="font-medium text-navy-900">Strictly necessary</span>
          <span className="text-xs font-semibold uppercase tracking-wide text-navy-500">Always on</span>
        </div>

        <label className="flex items-center justify-between gap-4 text-sm">
          <span className="font-medium text-navy-900">Analytics</span>
          <input
            type="checkbox"
            data-testid="policy-analytics-toggle"
            checked={analyticsAllowed}
            onChange={(e) => setAnalytics(e.target.checked)}
            className="h-4 w-4"
            aria-label="Allow analytics"
          />
        </label>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            data-testid="policy-withdraw"
            onClick={withdraw}
            className="btn-secondary !px-3 !py-1.5 text-xs"
          >
            Withdraw consent
          </button>
          <button
            type="button"
            data-testid="policy-reject-all"
            onClick={rejectAll}
            className="btn-secondary !px-3 !py-1.5 text-xs"
          >
            Reject all non-essential
          </button>
        </div>
      </div>
    </section>
  );
}