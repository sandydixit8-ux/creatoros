"use client";

import { useState } from "react";
import Link from "next/link";
import { useConsent } from "@/lib/use-consent";

/**
 * Cookie consent banner (D-5).
 *
 * Reject is the visually equal, equally prominent action and is offered before
 * Accept. A banner where the only reachable button grants consent is not a
 * choice under UK GDPR/PECR.
 *
 * Deliberately rendered in normal document flow rather than as a fixed overlay.
 * A `position: fixed` bar pinned to the bottom of the viewport covers whatever
 * happens to sit at the bottom of the screen, which silently swallows clicks on
 * real controls - checkout buttons in particular, which is the last place to
 * put a consent prompt. In-flow it cannot intercept page content at all.
 *
 * Mounted above the page content and client-only, so it is immediately visible
 * on arrival without appearing in SSR output or shifting server-rendered HTML.
 */
export function ConsentBanner() {
  const { ready, record, acceptAll, rejectAll, setAnalytics } = useConsent();
  const [manage, setManage] = useState(false);
  // Held locally until "Save preferences" so that toggling the checkbox does not
  // persist mid-interaction and dismiss the banner.
  const [draft, setDraft] = useState(false);

  // `ready` false means we have not read storage yet; showing the banner then
  // would flash it at visitors who already decided.
  if (!ready || record !== null) return null;

  return (
    <section
      aria-label="Cookie preferences"
      data-testid="consent-banner"
      className="border-b border-navy-100 bg-navy-50"
    >
      <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-sm font-bold text-navy-900">Cookies and measurement</h2>
            <p className="mt-0.5 text-sm text-navy-600">
              We use strictly necessary cookies to keep you signed in and the service secure. We
              would also like to record analytics about how visitors use public pages, which is
              stored in our own database. We do not use third-party advertising cookies.
            </p>
            <Link href="/cookie-policy" className="mt-0.5 inline-block text-sm font-medium text-brand-600 underline">
              Read the Cookie Policy
            </Link>
          </div>

          <div className="flex shrink-0 flex-col gap-2">
            {manage ? (
              <div className="flex flex-col gap-2 rounded-xl border border-navy-100 bg-navy-50 p-3" data-testid="consent-options">
                <label className="flex items-center justify-between gap-4 text-sm">
                  <span className="font-medium text-navy-900">Strictly necessary</span>
                  <span className="text-xs font-semibold uppercase tracking-wide text-navy-500">Always on</span>
                </label>
                <label className="flex items-center justify-between gap-4 text-sm">
                  <span className="font-medium text-navy-900">Analytics</span>
                  <input
                    type="checkbox"
                    data-testid="consent-analytics-toggle"
                    checked={manage ? draft : false}
                    onChange={(e) => setDraft(e.target.checked)}
                    className="h-4 w-4"
                    aria-label="Allow analytics"
                  />
                </label>
                <div className="mt-1 flex gap-2">
                  <button
                    type="button"
                    data-testid="consent-save"
                    onClick={() => {
                      setAnalytics(draft);
                      setManage(false);
                    }}
                    className="btn-primary !px-3 !py-1.5 text-xs"
                  >
                    Save preferences
                  </button>
                  <button
                    type="button"
                    data-testid="consent-cancel-manage"
                    onClick={() => {
                      setDraft(false);
                      setManage(false);
                    }}
                    className="btn-secondary !px-3 !py-1.5 text-xs"
                  >
                    Back
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid="consent-reject"
                  onClick={rejectAll}
                  className="btn-secondary !px-4 !py-2 text-sm"
                >
                  Reject analytics
                </button>
                <button
                  type="button"
                  data-testid="consent-accept"
                  onClick={acceptAll}
                  className="btn-primary !px-4 !py-2 text-sm"
                >
                  Accept analytics
                </button>
                <button
                  type="button"
                  data-testid="consent-manage"
                  onClick={() => setManage(true)}
                  className="text-xs font-medium text-navy-600 underline"
                >
                  Manage preferences
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}