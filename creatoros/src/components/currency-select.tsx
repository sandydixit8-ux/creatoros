"use client";

import { useRouter } from "next/navigation";
import { CURRENCY_LABELS, setCurrencyCookie } from "@/lib/currency";

/**
 * Per-visitor currency picker for plan checkout. Writing the `cc` cookie and
 * refreshing the route keeps the server-rendered prices and the checkout
 * charge in the same currency.
 */
export default function CurrencySelect({ value, currencies }: { value: string; currencies: string[] }) {
  const router = useRouter();

  if (currencies.length < 2) return null;

  return (
    <select
      value={value}
      onChange={(e) => {
        setCurrencyCookie(e.target.value);
        router.refresh();
      }}
      aria-label="Checkout currency"
      className="rounded-lg border border-navy-200 bg-white px-3 py-1.5 text-sm font-medium text-navy-800 focus:border-brand-400 focus:outline-none"
    >
      {currencies.map((c) => (
        <option key={c} value={c}>
          {CURRENCY_LABELS[c] ?? c.toUpperCase()}
        </option>
      ))}
    </select>
  );
}