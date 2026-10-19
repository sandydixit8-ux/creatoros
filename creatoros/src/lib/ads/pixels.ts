import { CONSENT_STORAGE_KEY, parseConsentRecord } from "@/lib/consent";

export type AdsConfig = {
  googleAdsId?: string;
  googleSignupLabel?: string;
  googlePurchaseLabel?: string;
  metaPixelId?: string;
};

export function adsConfig(): AdsConfig {
  return {
    googleAdsId: process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || undefined,
    googleSignupLabel: process.env.NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL || undefined,
    googlePurchaseLabel: process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL || undefined,
    metaPixelId: process.env.NEXT_PUBLIC_META_PIXEL_ID || undefined,
  };
}

export function adsEnabled(): boolean {
  const c = adsConfig();
  return Boolean(c.googleAdsId || c.metaPixelId);
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

export function trackSignupConversion(): boolean {
  const a = trackGoogleAdsConversion(adsConfig().googleSignupLabel);
  const b = trackMetaEvent("CompleteRegistration");
  return a || b;
}

export function trackPurchaseConversion(opts: ConversionValue): boolean {
  const a = trackGoogleAdsConversion(adsConfig().googlePurchaseLabel, opts);
  const b = trackMetaEvent(
    "Purchase",
    { value: opts.value, currency: opts.currency },
    opts.transactionId
  );
  return a || b;
}
