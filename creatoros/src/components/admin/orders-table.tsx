"use client";

import { useState } from "react";
import { formatMoneyCents } from "@/lib/money-format";

interface AdminOrder {
  id: string;
  tenant_id: string;
  org_name: string | null;
  email: string;
  status: string;
  amount_cents: number;
  refunded_cents: number;
  currency: string;
  provider: string;
  created_at: string;
  has_pending_refund: boolean;
}

export function OrdersTable({ initial }: { initial: AdminOrder[] }) {
  const [orders, setOrders] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refund(o: AdminOrder) {
    const remaining = o.amount_cents - o.refunded_cents;
    if (!window.confirm(`Refund ${formatMoneyCents(remaining, o.currency)} on order ${o.id}?`)) return;
    setBusy(o.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${o.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "admin refund" }),
      });
      const json = await res.json();
      if (json.ok) {
        setOrders((prev) =>
          prev.map((o2) =>
            o.id === o2.id
              ? {
                  ...o2,
                  refunded_cents: json.data.totalRefunded,
                  status: json.data.fullyRefunded ? "refunded" : "paid",
                  has_pending_refund: false,
                }
              : o2
          )
        );
      } else {
        setError(json?.error?.message ?? "Refund failed");
      }
    } catch {
      setError("Refund failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      {error && <div className="card border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Orders</caption>
          <thead className="border-b border-navy-100 text-xs uppercase text-navy-400">
            <tr>
              <th scope="col" className="px-4 py-3">Order</th>
              <th scope="col" className="px-4 py-3">Workspace</th>
              <th scope="col" className="px-4 py-3">Amount</th>
              <th scope="col" className="px-4 py-3">Refunded</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="px-4 py-3">Created</th>
              <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-50">
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-navy-500">No orders yet.</td>
              </tr>
            )}
            {orders.map((o) => {
              const refundable = o.status === "paid" && !o.has_pending_refund && o.refunded_cents < o.amount_cents;
              return (
                <tr key={o.id}>
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs text-navy-700">{o.id}</div>
                    <div className="text-xs text-navy-400">{o.email || "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-navy-600">{o.org_name ?? o.tenant_id}</td>
                  <td className="px-4 py-3 text-navy-700">{formatMoneyCents(o.amount_cents, o.currency)}</td>
                  <td className="px-4 py-3 text-navy-600">{o.refunded_cents ? formatMoneyCents(o.refunded_cents, o.currency) : "—"}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-navy-50 px-2 py-0.5 text-xs font-medium capitalize text-navy-600">{o.status}</span>
                  </td>
                  <td className="px-4 py-3 text-navy-500">{new Date(o.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={!refundable || busy === o.id}
                      onClick={() => refund(o)}
                      className="btn-secondary !py-1.5 text-xs"
                    >
                      {o.has_pending_refund ? "Refund pending" : busy === o.id ? "Refunding…" : "Refund"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
