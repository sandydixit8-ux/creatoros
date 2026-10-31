"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  calculateFees,
  projectMonth,
  formatMoney,
  formatPercent,
  type FeeCurrency,
} from "@/lib/etsy-fees";

function Field({
  id,
  label,
  hint,
  value,
  onChange,
  prefix,
  suffix,
  step = "0.01",
  min = "0",
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
  suffix?: string;
  step?: string;
  min?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-ink-muted">
          {hint}
        </p>
      )}
      <div className="mt-2 flex items-center rounded-xl border border-white/10 bg-night-900 focus-within:border-brand-400">
        {prefix && <span className="pl-4 text-sm text-ink-muted">{prefix}</span>}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          value={value}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent px-4 py-3 text-ink tabular-nums outline-none"
        />
        {suffix && <span className="pr-4 text-sm text-ink-muted">{suffix}</span>}
      </div>
    </div>
  );
}

export default function EtsyFeeCalculator() {
  const [currency, setCurrency] = useState<FeeCurrency>("gbp");
  const [price, setPrice] = useState("20");
  const [shipping, setShipping] = useState("0");
  const [orders, setOrders] = useState("40");
  const [offsiteAds, setOffsiteAds] = useState(false);
  const [feeVat, setFeeVat] = useState(false);

  const symbol = currency === "gbp" ? "£" : "$";

  const breakdown = useMemo(
    () =>
      calculateFees({
        currency,
        price: Number(price),
        shipping: Number(shipping),
        offsiteAds,
        feeVat: currency === "gbp" && feeVat,
      }),
    [currency, price, shipping, offsiteAds, feeVat]
  );

  const month = useMemo(() => projectMonth(breakdown, Number(orders)), [breakdown, orders]);

  const money = (n: number) => formatMoney(n, currency);

  const rows = [
    { label: "Listing fee", value: breakdown.listing, always: true },
    { label: "Transaction fee (6.5%)", value: breakdown.transaction, always: true },
    {
      label: currency === "gbp" ? "Payment processing (4% + £0.20)" : "Payment processing (3% + $0.25)",
      value: breakdown.processing,
      always: true,
    },
    {
      label: "Regulatory Operating Fee (0.48%)",
      value: breakdown.regulatory,
      always: currency === "gbp",
    },
    { label: "Offsite Ads (15%)", value: breakdown.offsiteAds, always: false },
    { label: "VAT on Etsy's fees (20%)", value: breakdown.feeVat, always: false },
  ].filter((r) => r.always || r.value > 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      {/* Inputs */}
      <div className="self-start rounded-2xl border border-white/10 bg-night-800/60 p-6 sm:p-7">
        <fieldset>
          <legend className="text-sm font-medium text-ink">Where are you selling?</legend>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(
              [
                { id: "gbp", label: "United Kingdom (£)" },
                { id: "usd", label: "United States ($)" },
              ] as const
            ).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCurrency(c.id)}
                aria-pressed={currency === c.id}
                className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                  currency === c.id
                    ? "border-brand-500/60 bg-brand-500/15 text-ink"
                    : "border-white/10 bg-night-900 text-ink-secondary hover:bg-white/5"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-6 space-y-5">
          <Field
            id="price"
            label="Item price"
            hint="What the buyer pays for the item itself."
            prefix={symbol}
            value={price}
            onChange={setPrice}
          />
          <Field
            id="shipping"
            label="Shipping charged"
            hint="Leave at 0 for a digital download."
            prefix={symbol}
            value={shipping}
            onChange={setShipping}
          />
          <Field
            id="orders"
            label="Orders per month"
            hint="Used for the monthly projection only."
            suffix="orders"
            step="1"
            value={orders}
            onChange={setOrders}
          />
        </div>

        <div className="mt-6 space-y-3">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-night-900 p-4">
            <input
              type="checkbox"
              checked={offsiteAds}
              onChange={(e) => setOffsiteAds(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-brand-500"
            />
            <span className="text-sm text-ink-secondary">
              <span className="font-medium text-ink">Sale came from Offsite Ads</span>
              <span className="mt-0.5 block text-xs text-ink-muted">
                Etsy takes 15% of the order total (12% for high-volume sellers) when an ad brings the buyer.
              </span>
            </span>
          </label>

          {currency === "gbp" && (
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-night-900 p-4">
              <input
                type="checkbox"
                checked={feeVat}
                onChange={(e) => setFeeVat(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-brand-500"
              />
              <span className="text-sm text-ink-secondary">
                <span className="font-medium text-ink">Include VAT on Etsy&apos;s fees</span>
                <span className="mt-0.5 block text-xs text-ink-muted">
                  Etsy adds 20% VAT to its own fees for UK sellers. This is tax, not Etsy&apos;s margin.
                </span>
              </span>
            </label>
          )}
        </div>
      </div>

      {/* Results */}
      <div aria-live="polite" className="space-y-4">
        <div className="rounded-2xl border border-brand-500/30 bg-gradient-to-br from-brand-600/20 to-cyan-500/10 p-6 sm:p-7">
          <p className="text-sm font-medium text-ink-secondary">You keep per sale</p>
          <p className="mt-2 text-4xl font-extrabold tracking-tight tabular-nums text-ink">{money(breakdown.net)}</p>
          <p className="mt-2 text-sm text-ink-secondary">
            Etsy takes <span className="font-semibold text-ink">{money(breakdown.totalFees)}</span> —{" "}
            {formatPercent(breakdown.effectivePct)} of the {money(breakdown.gross)} order.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-night-800/60 p-6">
          <h2 className="text-sm font-semibold text-ink">Fee breakdown</h2>
          <dl className="mt-4 space-y-2.5 text-sm">
            {rows.map((r) => (
              <div key={r.label} className="flex items-baseline justify-between gap-4">
                <dt className="text-ink-secondary">{r.label}</dt>
                <dd className="tabular-nums text-ink">−{money(r.value)}</dd>
              </div>
            ))}
            <div className="flex items-baseline justify-between gap-4 border-t border-white/10 pt-3">
              <dt className="font-semibold text-ink">Total Etsy fees</dt>
              <dd className="font-semibold tabular-nums text-ink">−{money(breakdown.totalFees)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-ink-secondary">Your payout</dt>
              <dd className="font-semibold tabular-nums text-emerald-300">{money(breakdown.net)}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-white/10 bg-night-800/60 p-6">
          <h2 className="text-sm font-semibold text-ink">At {month.orders} orders a month</h2>
          <dl className="mt-4 space-y-2.5 text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-ink-secondary">Revenue</dt>
              <dd className="tabular-nums text-ink">{money(month.gross)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-ink-secondary">Etsy keeps</dt>
              <dd className="tabular-nums text-ink">−{money(month.fees)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-t border-white/10 pt-3">
              <dt className="font-semibold text-ink">You keep</dt>
              <dd className="font-semibold tabular-nums text-emerald-300">{money(month.net)}</dd>
            </div>
          </dl>
          <p className="mt-4 rounded-xl border border-white/10 bg-night-900 p-4 text-xs leading-relaxed text-ink-muted">
            On your own store, the same {month.orders} orders would leave you with roughly{" "}
            {money(month.ownStoreNet)} instead of {money(month.net)} — about{" "}
            <span className="font-semibold text-ink-secondary">{money(Math.abs(month.delta))} a month more</span>. That
            only counts if you can bring the buyers yourself: Etsy&apos;s cut buys discovery.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-ink-muted">
            Own-store comparison uses Stripe standard pricing: 1.5% + 20p for UK cards, 2.9% + 30¢ for US cards.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-night-800/60 p-6 text-center">
          <p className="text-sm text-ink-secondary">
            Want the same maths on a store you own — free to start, no card?
          </p>
          <Link href="/auth/register" className="btn-primary mt-4 inline-flex px-6 py-3">
            Start for Free <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        <p className="text-xs leading-relaxed text-ink-muted">
          Rates are Etsy&apos;s published UK and US fees as of October 2026, checked against{" "}
          <Link href="/blog/how-much-does-etsy-take-uk" className="text-brand-300 underline-offset-4 hover:underline">
            our full UK fee breakdown
          </Link>
          . Payment processing assumes Etsy Payments in the seller&apos;s own country and a single-item order. Etsy can
          change its fees at any time — check your Payment account before pricing.
        </p>
      </div>
    </div>
  );
}
