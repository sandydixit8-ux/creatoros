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
};

function loadGtag(id: string) {
  const w = window as AdsWindow;
  w.dataLayer = w.dataLayer || [];
  if (typeof w.gtag !== "function") {
    w.gtag = function gtag(...args: unknown[]) {
      (w.dataLayer as unknown[]).push(args);
    };
  }
  w.gtag("js", new Date());
  w.gtag("config", id, { anonymize_ip: true });
  if (!document.getElementById("gtag-js")) {
    const s = document.createElement("script");
    s.id = "gtag-js";
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
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

export function ThirdPartyTags() {
  const { analyticsAllowed } = useConsent();
  const { googleAdsId, metaPixelId } = adsConfig();

  useEffect(() => {
    if (!analyticsAllowed) return;
    if (googleAdsId) loadGtag(googleAdsId);
    if (metaPixelId) loadMetaPixel(metaPixelId);
  }, [analyticsAllowed, googleAdsId, metaPixelId]);

  return null;
}
