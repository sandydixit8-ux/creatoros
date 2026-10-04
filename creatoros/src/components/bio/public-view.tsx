"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, CalendarCheck, Check, Instagram, Globe, Youtube, Linkedin, Twitter, Music2, Mail, Link2 } from "lucide-react";
import type { PublicBioPage } from "@/lib/bio/page";
import { SITE_URL } from "@/lib/constants";
import { formatPrice } from "@/lib/money";
import { openCashfreeCheckout } from "@/lib/payments/cashfree-checkout";
import { sanitizeUrl } from "@/lib/url-safety";

/**
 * Render-time backstop for href sinks. Writes are already scheme-checked at the
 * API boundary; this also neutralises any unsafe URL already stored in the
 * database before an allowlist shipped.
 */
function safeHref(value: unknown): string {
  return sanitizeUrl(value) || "#";
}

export function PublicBioPageView({ bio }: { bio: PublicBioPage }) {
  const theme = bio.page.theme;
  const accent = theme.accent || "#4f46e5";
  const [visitorId] = useState(() => (typeof globalThis !== "undefined" && globalThis.crypto ? globalThis.crypto.randomUUID() : `v${Date.now()}`));

  // fire-and-forget view tracking on mount (first-party)
  useEffect(() => {
    fetch(`${SITE_URL}/api/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: bio.profile.username,
        pageSlug: bio.page.slug,
        eventType: "page_view",
        visitorId,
      }),
    }).catch(() => {});
  }, [bio.profile.username, bio.page.slug, visitorId]);

  function trackLink(url: string) {
    fetch(`${SITE_URL}/api/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: bio.profile.username, pageSlug: bio.page.slug, eventType: "link_click", ref: url, visitorId }),
    }).catch(() => {});
  }

  const socials = bio.profile.socials || {};
  const socialLinks = [
    { key: "instagram", icon: Instagram, url: socials.instagram },
    { key: "youtube", icon: Youtube, url: socials.youtube },
    { key: "twitter", icon: Twitter, url: socials.twitter },
    { key: "linkedin", icon: Linkedin, url: socials.linkedin },
    { key: "tiktok", icon: Music2, url: socials.tiktok },
    { key: "website", icon: Globe, url: bio.profile.website },
  ].filter((s) => s.url);

  return (
    <div
      className="min-h-screen"
      style={{ background: theme.bg ? `linear-gradient(180deg, ${theme.bg}_14, ${theme.bg}_04)` : undefined, backgroundColor: theme.bgColor || "#f7f7fb" }}
    >
      <div className="mx-auto max-w-[520px] px-4 py-10">
        <BannerImg url={bio.profile.avatarUrl} accent={accent} />
        <h1 className="mt-4 text-center text-2xl font-bold" style={{ color: theme.textColor || "#111827" }}>
          {bio.profile.displayName || bio.profile.username}
        </h1>
        {bio.profile.bio && (
          <p className="mx-auto mt-2 max-w-sm text-center text-sm leading-relaxed" style={{ color: theme.textMuted || "#6b7280" }}>
            {bio.profile.bio}
          </p>
        )}
        {socialLinks.length > 0 && (
          <div className="mt-4 flex items-center justify-center gap-3">
            {socialLinks.map((s) => (
              <a
                key={s.key}
                href={safeHref(s.url)}
                target="_blank"
                rel="noreferrer"
                onClick={() => trackLink(s.url!)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-navy-500 shadow-soft transition hover:scale-105 hover:text-brand-600"
              >
                <s.icon className="h-4.5 w-4.5" />
              </a>
            ))}
          </div>
        )}

        <div className="mt-6 space-y-4">
          {bio.blocks.map((block) => (
            <BlockRenderer
              key={block.id}
              block={block}
              bio={bio}
              accent={accent}
              visitorId={visitorId}
              trackLink={trackLink}
            />
          ))}
        </div>

        {bio.products.length > 0 && (
          <div className="mt-8">
            <div className="mb-3 text-center text-[11px] font-semibold uppercase tracking-wider" style={{ color: theme.textMuted || "#6b7280" }}>
              Store
            </div>
            <div className="space-y-3">
              {bio.products.map((prod) => (
                <BuyProductCard key={prod.id} product={prod} accent={accent} visitorId={visitorId} />
              ))}
            </div>
          </div>
        )}

        <footer className="mt-12 text-center text-xs text-navy-400">
          Created with <span className="font-medium" style={{ color: accent }}>CreatorOS</span>
        </footer>
      </div>
    </div>
  );
}

function BannerImg({ url, accent }: { url: string; accent: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="mx-auto h-28 w-28 rounded-full border-4 border-white object-cover shadow-soft" />;
  }
  return (
    <div
      className="mx-auto h-28 w-28 rounded-full border-4 border-white shadow-soft"
      style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}
    />
  );
}

const roundedCls = "rounded-2xl";

function BuyProductCard(props: {
  product: PublicBioPage["products"][number];
  accent: string;
  visitorId: string;
}) {
  const { product, accent, visitorId } = props;
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [handedOff, setHandedOff] = useState(false);

  async function startCheckout(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/store/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, email: email.trim(), phone: phone.trim(), visitorId }),
      });
      const j = await res.json();
      if (j.ok && j.data?.clientSessionId) {
        // Cashfree: the SDK opens checkout; there is no hosted URL to redirect to.
        // The SDK resolves as soon as it hands off to the hosted page, so keep
        // the button disabled — otherwise a slow load invites a second click and
        // a duplicate live order.
        await openCashfreeCheckout(j.data.clientSessionId, j.data.sdkMode === "sandbox" ? "sandbox" : "production");
        setHandedOff(true);
        return;
      }
      if (j.ok && j.data?.url) {
        setHandedOff(true);
        window.location.href = j.data.url;
        return;
      }
      setError(j.error?.message || "Checkout unavailable right now");
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Checkout could not start. Please try again.");
    } finally {
      // A handed-off checkout must stay locked until the page navigates away.
      if (!handedOff) setBusy(false);
    }
  }

  return (
    <div className={`${roundedCls} bg-white px-5 py-4 shadow-soft`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-navy-900">{product.name}</div>
          {product.description ? (
            <div className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-navy-500">{product.description}</div>
          ) : null}
        </div>
        <div className="text-sm font-bold" style={{ color: accent }}>
          {formatPrice(product.price_cents, product.currency)}
        </div>
      </div>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 w-full rounded-xl px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
          style={{ background: accent }}
        >
          Buy now
        </button>
      ) : (
        <form onSubmit={startCheckout} className="mt-3 space-y-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className="w-full rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm text-navy-900 placeholder:text-navy-400 focus:border-brand-500 focus:outline-none"
          />
          <input
            type="tel"
            inputMode="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number"
            className="w-full rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm text-navy-900 placeholder:text-navy-400 focus:border-brand-500 focus:outline-none"
          />
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="flex-1 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
              style={{ background: accent }}
            >
              {busy ? "Redirecting…" : `Pay ${formatPrice(product.price_cents, product.currency)}`}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 text-sm font-medium text-navy-500 hover:text-navy-800">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function BlockRenderer(props: {
  block: PublicBioPage["blocks"][number];
  bio: PublicBioPage;
  accent: string;
  visitorId: string;
  trackLink: (url: string) => void;
}) {
  const { block, bio, accent, visitorId, trackLink } = props;
  const p = block.payload;

  switch (block.type) {
    case "link":
      return (
        <a
          href={safeHref(p.url)}
          target="_blank"
          rel="noreferrer"
          onClick={() => trackLink(String(p.url || ""))}
          className={`${roundedCls} flex items-center justify-between bg-white px-5 py-4 text-sm font-semibold shadow-soft transition hover:scale-[1.02]`}
          style={{ color: "#111827" }}
        >
          <span className="flex items-center gap-2"><Link2 className="h-4 w-4" style={{ color: accent }} />{p.title || "Link"}</span>
          <ArrowRight className="h-4 w-4 text-navy-300" />
        </a>
      );
    case "cta":
      return (
        <a
          href={safeHref(p.url)}
          target="_blank"
          rel="noreferrer"
          onClick={() => trackLink(String(p.url || ""))}
          className={`${roundedCls} flex items-center justify-center bg-white px-5 py-4 text-sm font-bold shadow-soft transition hover:scale-[1.02]`}
          style={{ color: accent }}
        >
          {p.text || "Learn more"}
        </a>
      );
    case "product":
      return (
        <a
          href={safeHref(p.url)}
          target="_blank"
          rel="noreferrer"
          onClick={() => trackLink(String(p.url || ""))}
          className={`${roundedCls} flex items-center justify-between bg-white px-5 py-4 shadow-soft transition hover:scale-[1.02]`}
        >
          <span className="text-sm font-semibold text-navy-900">{p.title || "Product"}</span>
          {p.price ? <span className="text-sm font-bold" style={{ color: accent }}>${p.price}</span> : null}
        </a>
      );
    case "booking":
      return (
        <a
          href={`${SITE_URL}/u/${bio.profile.username}/book/${p.serviceSlug || ""}`}
          onClick={() => trackLink(`${SITE_URL}/u/${bio.profile.username}/book/${p.serviceSlug || ""}`)}
          className={`${roundedCls} flex items-center justify-center gap-2 px-5 py-4 text-sm font-bold text-white shadow-soft transition hover:scale-[1.02]`}
          style={{ background: accent }}
        >
          <CalendarCheck className="h-4 w-4" /> Book a call
        </a>
      );
    case "email_capture":
      return <EmailCaptureBlock block={block} bio={bio} accent={accent} visitorId={visitorId} />;
    case "social":
      return (
        <div className="flex items-center justify-center gap-4 pb-1 pt-1">
          {["instagram", "youtube", "twitter"].map((k) => (
            <span key={k} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/70 text-navy-400">
              <Mail className="hidden" />
            </span>
          ))}
        </div>
      );
    case "bio":
      return (
        <div className={`${roundedCls} bg-white/70 px-5 py-4 text-sm leading-relaxed text-navy-600`}>
          {p.text || ""}
        </div>
      );
    case "profile":
      return (
        <div className="text-center">
          <div className="text-base font-semibold text-navy-900">{p.title || bio.profile.displayName}</div>
          {p.subtitle ? <div className="mt-0.5 text-xs text-navy-500">{p.subtitle}</div> : null}
        </div>
      );
    default:
      return null;
  }
}

function EmailCaptureBlock(props: {
  block: PublicBioPage["blocks"][number];
  bio: PublicBioPage;
  accent: string;
  visitorId: string;
}) {
  const { block, bio, accent, visitorId } = props;
  const p = block.payload;
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const inFlight = useRef(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;
    if (!consent) {
      setMsg("Please agree to receive updates.");
      setState("error");
      return;
    }
    inFlight.current = true;
    setState("loading");
    try {
      const res = await fetch(`${SITE_URL}/api/leads/capture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: bio.profile.username,
          pageSlug: bio.page.slug,
          email,
          name,
          consent,
          source: "bio",
          visitorId,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setState("done");
        setMsg(json.data?.message || "Subscribed!");
      } else {
        setState("error");
        setMsg(json.error?.message || "Something went wrong");
      }
    } catch {
      setState("error");
      setMsg("Network error");
    } finally {
      inFlight.current = false;
    }
  }

  if (state === "done") {
    return (
      <div className={`${roundedCls} flex items-center justify-center gap-2 bg-white px-5 py-4 text-sm font-semibold text-emerald-600 shadow-soft`}>
        <Check className="h-4 w-4" /> {msg}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={`${roundedCls} bg-white px-5 py-5 shadow-soft`}>
      <div className="text-sm font-semibold text-navy-900">{p.title || "Get updates"}</div>
      <div className="mt-3 space-y-2">
        <input
          className="w-full rounded-xl border border-navy-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
          style={{ borderColor: state === "error" ? "#ef4444" : undefined }}
          placeholder="Your name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="w-full rounded-xl border border-navy-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
          style={{ borderColor: state === "error" ? "#ef4444" : undefined }}
          placeholder="you@example.com"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label className="flex items-start gap-2 text-xs text-navy-500">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
          <span>I agree to receive email updates and to my contact details being stored by the creator.</span>
        </label>
        {state === "error" && <p className="text-xs text-red-600">{msg}</p>}
        <button
          type="submit"
          disabled={state === "loading"}
          className="w-full rounded-xl px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
          style={{ background: accent }}
        >
          {state === "loading" ? "Subscribing…" : (p.buttonLabel as string) || "Subscribe"}
        </button>
      </div>
    </form>
  );
}