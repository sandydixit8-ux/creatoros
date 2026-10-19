import { notFound } from "next/navigation";
import { CheckCircle2, Clock } from "lucide-react";
import { row, all } from "@/lib/db/db";
import { formatPrice } from "@/lib/money";
import { AdsConversion } from "@/components/analytics/ads-conversion";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const order = row<{ status: string }>("SELECT status FROM orders WHERE token = ?", token);
  return { title: order ? `Receipt — order ${order.status}` : "Receipt" };
}

export default async function ReceiptPage({ params }: Props) {
  const { token } = await params;
  const order = row<{
    id: string;
    email: string;
    status: string;
    amount_cents: number;
    currency: string;
    created_at: string;
  }>("SELECT id, email, status, amount_cents, currency, created_at FROM orders WHERE token = ?", token);
  if (!order) notFound();

  const items = all<{ title: string; quantity: number; unit_price_cents: number }>(
    "SELECT title, quantity, unit_price_cents FROM order_items WHERE order_id = ?",
    order.id
  );

  const paid = order.status === "paid";

  return (
    <div className="min-h-screen bg-navy-50 px-4 py-12">
      <main className="mx-auto max-w-md">
        {paid && (
          <AdsConversion
            type="purchase"
            value={order.amount_cents / 100}
            currency={order.currency.toUpperCase()}
            transactionId={order.id}
          />
        )}
        <div className="card p-6">
          <div className="flex items-center gap-3">
            {paid ? (
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </span>
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <Clock className="h-5 w-5" />
              </span>
            )}
            <div>
              <h1 className="text-lg font-bold text-navy-900">{paid ? "Payment received" : "Payment processing"}</h1>
              <p className="text-sm text-navy-500">
                {paid
                  ? "A confirmation has been recorded for this order."
                  : "We're waiting for confirmation from the payment provider. This receipt will update automatically."}
              </p>
            </div>
          </div>

          <div className="mt-5 divide-y divide-navy-100 border-y border-navy-100">
            {items.map((it) => (
              <div key={it.title} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <div className="font-medium text-navy-900">{it.title}</div>
                  <div className="text-xs text-navy-400">Qty {it.quantity}</div>
                </div>
                <div className="font-semibold text-navy-900">{formatPrice(it.unit_price_cents * it.quantity, order.currency)}</div>
              </div>
            ))}
            <div className="flex items-center justify-between py-3 text-sm font-bold text-navy-900">
              <span>Total</span>
              <span>{formatPrice(order.amount_cents, order.currency)}</span>
            </div>
          </div>

          <dl className="mt-4 space-y-1 text-xs text-navy-500">
            <div className="flex justify-between">
              <dt>Order</dt>
              <dd className="font-mono">{order.id}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Email</dt>
              <dd>{order.email}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Date</dt>
              <dd>{order.created_at.slice(0, 19).replace("T", " ")}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Status</dt>
              <dd className="capitalize">{order.status}</dd>
            </div>
          </dl>
        </div>

        <p className="mt-4 text-center text-xs text-navy-400">Questions about this order? Contact the creator directly.</p>
      </main>
    </div>
  );
}
