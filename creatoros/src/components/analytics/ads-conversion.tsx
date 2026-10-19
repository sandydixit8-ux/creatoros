"use client";

import { useEffect, useRef } from "react";
import { trackPurchaseConversion, trackSignupConversion } from "@/lib/ads/pixels";

const CONSENT_EVENT = "creatoros:consent-change";

export function AdsConversion({
  type,
  value,
  currency,
  transactionId,
}: {
  type: "signup" | "purchase";
  value?: number;
  currency?: string;
  transactionId?: string;
}) {
  const fired = useRef(false);

  useEffect(() => {
    const attempt = () => {
      if (fired.current) return;
      const ok =
        type === "signup"
          ? trackSignupConversion()
          : trackPurchaseConversion({ value, currency, transactionId });
      if (ok) fired.current = true;
    };
    attempt();
    window.addEventListener(CONSENT_EVENT, attempt);
    return () => window.removeEventListener(CONSENT_EVENT, attempt);
  }, [type, value, currency, transactionId]);

  return null;
}
