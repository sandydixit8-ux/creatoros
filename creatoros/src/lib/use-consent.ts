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

  const save = useCallback((next: ConsentRecord) => {
    try {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable (private mode). The in-memory state still applies
      // for this page view; consent simply will not persist across visits.
    }
    setRecord(next);
    window.dispatchEvent(new Event(EVENT));
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
    /** Send this with any analytics request so the server can authorise it. */
    consentSignal,
    acceptAll,
    rejectAll,
    setAnalytics,
    withdraw,
  };
}