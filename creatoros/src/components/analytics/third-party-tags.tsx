"use client";

import { useEffect } from "react";
import { useConsent } from "@/lib/use-consent";
import { adsConfig } from "@/lib/ads/pixels";

type AdsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  fbq?: ((...args: unknown[]) => void) & {
    callMethod?: (...args: unknown[]) => void;
    queue: unknown[];
    push: unknown;
    loaded: boolean;
    version: string;
  };
  _fbq?: unknown;
  clarity?: ((...args: unknown[]) => void) & { q?: unknown[] };
};

function loadGtag(gadsId?: string, ga4Id?: string) {
  const w = window as AdsWindow;
  const primaryId = gadsId || ga4Id;
  if (!primaryId) return;
  w.dataLayer = w.dataLayer || [];
  if (typeof w.gtag !== "function") {
    w.gtag = function gtag(...args: unknown[]) {
      (w.dataLayer as unknown[]).push(args);
    };
  }
  w.gtag("js", new Date());
  // Announce Consent Mode v2 defaults before config so GA4 does not fall back
  // to its implicit "denied" state (which silently suppresses every beacon,
  // leaving Realtime empty even though the tag loaded fine).
  w.gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
  });
  w.gtag("consent", "update", {
    ad_storage: "granted",
    ad_user_data: "granted",
    ad_personalization: "granted",
    analytics_storage: "granted",
  });
  if (gadsId) w.gtag("config", gadsId, { anonymize_ip: true });
  if (ga4Id) w.gtag("config", ga4Id, { anonymize_ip: true });
  if (!document.getElementById("gtag-js")) {
    const s = document.createElement("script");
    s.id = "gtag-js";
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(primaryId)}`;
    document.head.appendChild(s);
  }
}

function loadMetaPixel(id: string) {
  const w = window as AdsWindow;
  if (!w.fbq) {
    const fbq = function (...args: unknown[]) {
      const n = fbq as unknown as { callMethod?: (...a: unknown[]) => void; queue: unknown[] };
      if (n.callMethod) n.callMethod(...args);
      else n.queue.push(args);
    } as unknown as NonNullable<AdsWindow["fbq"]>;
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.queue = [];
    w.fbq = fbq;
    w._fbq = fbq;
  }
  if (!document.getElementById("meta-pixel")) {
    const s = document.createElement("script");
    s.id = "meta-pixel";
    s.async = true;
    s.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(s);
  }
  w.fbq("init", id);
  w.fbq("track", "PageView");
}

function loadClarity(projectId: string) {
  const w = window as AdsWindow;
  if (!w.clarity) {
    const clarity = function (...args: unknown[]) {
      const c = clarity as unknown as { q?: unknown[] };
      (c.q = c.q || []).push(args);
    } as unknown as NonNullable<AdsWindow["clarity"]>;
    w.clarity = clarity;
  }
  if (!document.getElementById("clarity-js")) {
    const s = document.createElement("script");
    s.id = "clarity-js";
    s.async = true;
    s.src = `https://www.clarity.ms/tag/${encodeURIComponent(projectId)}`;
    document.head.appendChild(s);
  }
}

export function ThirdPartyTags() {
  const { analyticsAllowed } = useConsent();
  const { googleAdsId, metaPixelId, gaMeasurementId, clarityProjectId } = adsConfig();

  useEffect(() => {
    if (!analyticsAllowed) return;
    if (googleAdsId || gaMeasurementId) loadGtag(googleAdsId, gaMeasurementId);
    if (metaPixelId) loadMetaPixel(metaPixelId);
    if (clarityProjectId) loadClarity(clarityProjectId);
  }, [analyticsAllowed, googleAdsId, gaMeasurementId, metaPixelId, clarityProjectId]);

  return null;
}
