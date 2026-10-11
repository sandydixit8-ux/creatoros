import Link from "next/link";

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
  { href: "/#pricing", label: "Pricing" },
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
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white">
                C
              </span>
              <span className="text-base tracking-tight">
                Creator<span className="bg-gradient-to-r from-brand-400 to-cyan-300 bg-clip-text text-transparent">OS</span>
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-muted">
              Create. Grow. Sell. Automate. The all-in-one operating system for creator-led businesses.
            </p>
            <p className="mt-6 text-xs text-ink-muted">Technology Partner: Ridhyansh Tech Infra Private Limited</p>
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