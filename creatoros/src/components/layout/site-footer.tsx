import Link from "next/link";

export const LEGAL_LINKS = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/refund-policy", label: "Refund Policy" },
  { href: "/cookie-policy", label: "Cookie Policy" },
  { href: "/contact", label: "Contact" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-navy-100 bg-navy-950 py-10 text-sm text-navy-300">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4">
        <nav aria-label="Legal" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {LEGAL_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="transition hover:text-white">
              {l.label}
            </Link>
          ))}
        </nav>
        <p>© {new Date().getFullYear()} CreatorOS. All rights reserved.</p>
        <p className="text-xs text-navy-400">Technology Partner: Ridhyansh Tech Infra Private Limited</p>
      </div>
    </footer>
  );
}
