"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export const DEFAULT_FAQ = [
  {
    q: "How do I get started?",
    a: "Create a free account at /auth/register — no card required. You set up your workspace and can publish a bio page within minutes.",
  },
  {
    q: "What can I build with CreatorOS?",
    a: "All nine modules are live: bio pages, a digital store, courses, bookings, email campaigns, a community, analytics, a leads CRM and the AI Strategy Coach.",
  },
  {
    q: "How does billing work?",
    a: "Start free forever. Paid plans (Starter $9 / £7, Creator $19 / £15, Pro $49 / £39, Business $99 / £79 per month) include applicable taxes, so the price at checkout is the price charged. INR pricing is available in-app. Upgrade, downgrade or cancel anytime from Settings → Billing.",
  },
  {
    q: "Who owns my data?",
    a: "You do. Export your data anytime from Settings → Privacy, and delete your workspace when you are done. Analytics are first-party — there is no cross-site tracking.",
  },
  {
    q: "What is the refund policy?",
    a: "Purchases are covered by a 14-day refund window — see our Refund Policy for details.",
  },
  {
    q: "How do I get support?",
    a: "Use the in-app support ticket, or email support@usecreatoros.co. We respond within 5 business days.",
  },
  {
    q: "Can I use my own domain?",
    a: "Yes — custom domains are available on the Creator plan and above.",
  },
  {
    q: "What are AI credits and how do limits work?",
    a: "The AI Strategy Coach analyzes your platform data and returns a scored growth plan. Each run uses AI credits (10 on Free, up to unlimited on Business). Results are AI-generated guidance, not financial advice.",
  },
] as const;

export function Faq({ items = DEFAULT_FAQ }: { items?: ReadonlyArray<{ q: string; a: string }> }) {
  const [open, setOpen] = useState<Set<number>>(() => new Set([0]));

  function toggle(i: number) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) {
        next.delete(i);
      } else {
        next.add(i);
      }
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-3xl divide-y divide-white/10 rounded-2xl border border-white/10 bg-night-800/60">
      {items.map((item, i) => {
        const isOpen = open.has(i);
        const panelId = `faq-panel-${i}`;
        const buttonId = `faq-button-${i}`;
        return (
          <div key={item.q}>
            <h3>
              <button
                type="button"
                id={buttonId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(i)}
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left text-base font-semibold text-ink transition-colors hover:text-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              >
                {item.q}
                <ChevronDown
                  className={`h-5 w-5 shrink-0 text-ink-muted transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </button>
            </h3>
            {isOpen && (
              <div id={panelId} role="region" aria-labelledby={buttonId} className="px-6 pb-6">
                <p className="text-sm leading-relaxed text-ink-secondary">{item.a}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}