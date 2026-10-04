"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CONSENT_STORAGE_KEY,
  buildConsentRecord,
  parseConsentRecord,
  toConsentSignal,
  type ConsentRecord,
} from "@/lib/consent";

const EVENT = "creatoros:consent-change";

/** Ask the server to mint a consent receipt. Resolves false if it refused. */
async function persistDecision(record: ConsentRecord): Promise<boolean> {
  try {
    const res = await fetch("/api/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ analytics: record.analytics, source: record.source }),
      credentials: "same-origin",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Read and write the visitor's consent record.
 *
 * Starts as `null` on both server and client so the first paint matches the
 * SSR output; the real value is read in an effect. Consumers must treat `null`
 * as "no decision yet" and therefore "analytics off".
 */
export function useConsent() {
  const [record, setRecord] = useState<ConsentRecord | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const read = () => {
      let parsed: ConsentRecord | null = null;
      try {
        const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
        if (raw) parsed = parseConsentRecord(JSON.parse(raw));
      } catch {
        // Private-mode or corrupted JSON: treat as no decision.
        parsed = null;
      }
      setRecord(parsed);
      setReady(true);
    };

    read();
    window.addEventListener(EVENT, read);
    // Keep multiple open tabs in agreement.
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);

  /**
   * Persist the decision.
   *
   * The server is called first because it is the authority: it mints the signed
   * consent receipt that `/api/track` actually authorises from, and a local-only
   * save would show "allowed" in the UI while the server still refused to record
   * anything. localStorage is then written as a mirror so the banner and the
   * preferences panel render correctly on the next paint without waiting on a
   * round trip, and so tabs stay in sync.
   *
   * On failure nothing is written and the banner stays up, which is the
   * conservative outcome: no receipt means no tracking.
   */
  const save = useCallback(async (next: ConsentRecord) => {
    const persisted = await persistDecision(next);
    if (!persisted) return false;

    try {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Private mode or storage full: the receipt still authorises tracking for
      // this and future visits, only the UI mirror is lost.
    }
    setRecord(next);
    window.dispatchEvent(new Event(EVENT));
    return true;
  }, []);

  const acceptAll = useCallback(
    () => save(buildConsentRecord({ analytics: true, source: "banner" })),
    [save]
  );

  const rejectAll = useCallback(
    () => save(buildConsentRecord({ analytics: false, source: "banner" })),
    [save]
  );

  /** Granular choice made from the preferences panel. */
  const setAnalytics = useCallback(
    (allowed: boolean) =>
      save(buildConsentRecord({ analytics: allowed, source: "preferences" })),
    [save]
  );

  /**
   * Explicit withdrawal. Back to the same state as a first-time visitor, which
   * is what the Cookie Policy promises when it says consent can be withdrawn
   * at any time.
   */
  const withdraw = useCallback(
    () => save(buildConsentRecord({ analytics: false, source: "withdrawn" })),
    [save]
  );

  // Memoised on `record` so the reference is stable across renders. If this
  // were a fresh object literal each time, every consumer that lists it in a
  // useEffect dependency array would re-fire its effect on every render - which
  // for the bio page meant re-reporting the same page view endlessly.
  const consentSignal = useMemo(() => toConsentSignal(record), [record]);

  return {
    record,
    ready,
    analyticsAllowed: record?.analytics === true,
    /**
     * Kept for callers that want to describe the current choice. The server no
     * longer reads this from tracking requests - it authorises from the signed
     * receipt - so it is informational only.
     */
    consentSignal,
    acceptAll,
    rejectAll,
    setAnalytics,
    withdraw,
  };
}