import { CONSENT_STORAGE_KEY, parseConsentRecord } from "@/lib/consent";

export type AdsConfig = {
  googleAdsId?: string;
  googleSignupLabel?: string;
  googlePurchaseLabel?: string;
  metaPixelId?: string;
  gaMeasurementId?: string;
};

export function adsConfig(): AdsConfig {
  return {
    googleAdsId: process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || undefined,
    googleSignupLabel: process.env.NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL || undefined,
    googlePurchaseLabel: process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL || undefined,
    metaPixelId: process.env.NEXT_PUBLIC_META_PIXEL_ID || undefined,
    gaMeasurementId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || undefined,
  };
}

export function adsEnabled(): boolean {
  const c = adsConfig();
  return Boolean(c.googleAdsId || c.metaPixelId || c.gaMeasurementId);
}

type AdsWindow = Window & {
  gtag?: (...args: unknown[]) => void;
  fbq?: (...args: unknown[]) => void;
};

export function hasAnalyticsConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return false;
    return parseConsentRecord(JSON.parse(raw))?.analytics === true;
  } catch {
    return false;
  }
}

type ConversionValue = { value?: number; currency?: string; transactionId?: string };

export function trackGoogleAdsConversion(label?: string, opts: ConversionValue = {}): boolean {
  const id = adsConfig().googleAdsId;
  if (!id || !label || !hasAnalyticsConsent()) return false;
  const w = window as AdsWindow;
  if (typeof w.gtag !== "function") return false;
  w.gtag("event", "conversion", {
    send_to: `${id}/${label}`,
    value: opts.value,
    currency: opts.currency,
    transaction_id: opts.transactionId,
  });
  return true;
}

export function trackMetaEvent(event: string, params?: Record<string, unknown>, eventId?: string): boolean {
  if (!adsConfig().metaPixelId || !hasAnalyticsConsent()) return false;
  const w = window as AdsWindow;
  if (typeof w.fbq !== "function") return false;
  w.fbq("track", event, params ?? {}, eventId ? { eventID: eventId } : undefined);
  return true;
}

/**
 * GA4 event tracking. Sends a `gtag('event', …)` for the Analytics 4 stream
 * (NEXT_PUBLIC_GA_MEASUREMENT_ID) so traffic and funnel events are visible in
 * Google Analytics, independent of the Ads conversion import.
 */
export function trackGa4Event(event: string, params: Record<string, unknown> = {}): boolean {
  if (!adsConfig().gaMeasurementId || !hasAnalyticsConsent()) return false;
  const w = window as AdsWindow;
  if (typeof w.gtag !== "function") return false;
  w.gtag("event", event, params);
  return true;
}

export function trackSignupConversion(): boolean {
  const a = trackGoogleAdsConversion(adsConfig().googleSignupLabel);
  const b = trackMetaEvent("CompleteRegistration");
  const c = trackGa4Event("sign_up", { method: "email" });
  return a || b || c;
}

export function trackPurchaseConversion(opts: ConversionValue): boolean {
  const a = trackGoogleAdsConversion(adsConfig().googlePurchaseLabel, opts);
  const b = trackMetaEvent(
    "Purchase",
    { value: opts.value, currency: opts.currency },
    opts.transactionId
  );
  const c = trackGa4Event("purchase", {
    value: opts.value,
    currency: opts.currency,
    transaction_id: opts.transactionId,
  });
  return a || b || c;
}
