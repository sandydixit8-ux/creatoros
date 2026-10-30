import Link from "next/link";
import { Facebook, Youtube, Linkedin } from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";

export const SOCIALS = [
  { href: "https://www.facebook.com/1299369053270317", label: "Facebook", icon: Facebook },
  { href: "https://www.youtube.com/channel/UCmOSwrdJWBbO3ILEZU0Jj1Q", label: "YouTube", icon: Youtube },
  { href: "https://www.linkedin.com/company/creatoros-os", label: "LinkedIn", icon: Linkedin },
];

export const LEGAL_LINKS = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/refund-policy", label: "Refund Policy" },
  { href: "/cookie-policy", label: "Cookie Policy" },
  { href: "/contact", label: "Contact" },
];

const PRODUCT_LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/#product", label: "Product" },
  { href: "/pricing", label: "Pricing" },
  { href: "/all-in-one-creator-platform", label: "All-in-one platform" },
  { href: "/linktree-alternative", label: "Linktree alternative" },
  { href: "/kajabi-alternative", label: "Kajabi alternative" },
  { href: "/sell-digital-products", label: "Sell digital products" },
  { href: "/creator-booking", label: "Bookings" },
  { href: "/podcast-monetization", label: "Podcast monetization" },
  { href: "/coach-booking", label: "Coach booking" },
  { href: "/blog", label: "Blog" },
  { href: "/#faq", label: "FAQ" },
];

const PLATFORM_LINKS = [
  { href: "/auth/register", label: "Start for Free" },
  { href: "/auth/login", label: "Sign in" },
  { href: "/u/democreator", label: "Sample creator page" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-night-950 text-sm text-ink-secondary">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5 font-semibold text-ink" aria-label="CreatorOS home">
              <BrandMark />
              <span className="text-base tracking-tight">
                Creator<span className="bg-gradient-to-r from-brand-400 to-cyan-300 bg-clip-text text-transparent">OS</span>
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-muted">
              Create. Grow. Sell. Automate. The all-in-one operating system for creator-led businesses.
            </p>
            <p className="mt-6 text-xs text-ink-muted">Technology Partner: Ridhyansh Tech Infra Private Limited</p>

            <ul className="mt-5 flex items-center gap-3">
              {SOCIALS.map((s) => (
                <li key={s.label}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`CreatorOS on ${s.label}`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-gradient-to-b from-white/15 to-white/5 text-ink-secondary shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_2px_4px_rgba(0,0,0,0.45)] transition-all duration-200 hover:-translate-y-0.5 hover:from-white/25 hover:to-white/10 hover:text-ink hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_6px_12px_rgba(0,0,0,0.55)] active:translate-y-0 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]"
                  >
                    <s.icon className="h-4 w-4 drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <nav aria-label="Product">
            <h2 className="text-sm font-semibold text-ink">Product</h2>
            <ul className="mt-4 space-y-3">
              {PRODUCT_LINKS.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-ink-secondary transition-colors hover:text-ink">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Platform">
            <h2 className="text-sm font-semibold text-ink">Platform</h2>
            <ul className="mt-4 space-y-3">
              {PLATFORM_LINKS.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-ink-secondary transition-colors hover:text-ink">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Legal">
            <h2 className="text-sm font-semibold text-ink">Company</h2>
            <ul className="mt-4 space-y-3">
              {LEGAL_LINKS.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-ink-secondary transition-colors hover:text-ink">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 sm:flex-row">
          <p className="text-xs text-ink-muted">© {new Date().getFullYear()} CreatorOS. All rights reserved.</p>
          <p className="text-xs text-ink-muted">Your data stays yours — export it anytime from your settings.</p>
        </div>
      </div>
    </footer>
  );
}