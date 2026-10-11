"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus } from "lucide-react";
import { ConfirmAction } from "@/components/ui/confirm-action";

export interface StoreProduct {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  currency: string;
  kind: string;
  media_url: string;
  page_id: string | null;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface StoreOrder {
  id: string;
  email: string;
  status: string;
  amount_cents: number;
  currency: string;
  created_at: string;
}

const emptyForm = { name: "", description: "", price: "", kind: "digital", media_url: "" };

export function StoreManager(props: { canWrite: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/store/products");
      const j = await res.json();
      if (j.ok) {
        setProducts(j.data.products);
        setOrders(j.data.orders);
        setLoaded(true);
      }
    } catch {
      /* keep last state */
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/store/products")
      .then((r) => r.json())
      .then((j: { ok: boolean; data?: { products: StoreProduct[]; orders: StoreOrder[] } }) => {
        if (!cancelled && j.ok && j.data) {
          setProducts(j.data.products);
          setOrders(j.data.orders);
          setLoaded(true);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded) {
    return (
      <div className="card p-8 text-center text-sm text-navy-500">Loading store…</div>
    );
  }

  function startEdit(p: StoreProduct) {
    setEditId(p.id);
    setForm({
      name: p.name,
      description: p.description,
      price: (p.price_cents / 100).toFixed(2),
      kind: p.kind,
      media_url: p.media_url,
    });
    setShowForm(true);
    setError("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const priceCents = Math.round(parseFloat(form.price || "0") * 100);
    if (Number.isNaN(priceCents) || priceCents < 0) {
      setError("Enter a valid price");
      setBusy(false);
      return;
    }
    try {
      const payload = {
        name: form.name,
        description: form.description,
        price_cents: priceCents,
        kind: form.kind,
        media_url: form.media_url,
      };
      const res = await fetch(editId ? `/api/store/products/${editId}` : "/api/store/products", {
        method: editId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (j.ok) {
        setForm(emptyForm);
        setEditId(null);
        setShowForm(false);
        await load();
        router.refresh();
      } else {
        setError(j.error?.message || "Could not save product");
      }
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(p: StoreProduct) {
    await fetch(`/api/store/products/${p.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: p.active !== 1 }),
    });
    await load();
    router.refresh();
  }

  async function remove(p: StoreProduct) {
    await fetch(`/api/store/products/${p.id}`, { method: "DELETE" });
    await load();
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-navy-900">Products</h2>
          {props.canWrite && !showForm && (
            <button type="button" onClick={() => { setEditId(null); setForm(emptyForm); setShowForm(true); setError(""); }} className="btn-primary !py-2 text-sm">
              <Plus className="h-4 w-4" /> New product
            </button>
          )}
        </div>

        {showForm && (
          <form onSubmit={submit} className="mt-4 grid gap-3 rounded-xl border border-brand-200 bg-brand-50/50 p-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="product-name">Name</label>
              <input id="product-name" className="input" required maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Logo design package" />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="product-description">Description</label>
              <textarea id="product-description" className="input" rows={2} maxLength={2000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What's included" />
            </div>
            <div>
              <label className="label" htmlFor="product-price">Price (USD)</label>
              <input id="product-price" className="input" required inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="19.00" />
            </div>
            <div>
              <label className="label" htmlFor="product-type">Type</label>
              <select id="product-type" className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                <option value="digital">Digital download</option>
                <option value="service">Service</option>
                <option value="physical">Physical</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="product-media">Media URL (optional)</label>
              <input id="product-media" className="input" maxLength={500} value={form.media_url} onChange={(e) => setForm({ ...form, media_url: e.target.value })} placeholder="https://…" />
            </div>
            {error && <p className="text-xs text-red-600 sm:col-span-2">{error}</p>}
            <div className="flex gap-2 sm:col-span-2">
              <button type="submit" disabled={busy} className="btn-primary !py-2 text-sm">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : editId ? "Save changes" : "Create product"}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditId(null); setError(""); }} className="btn-secondary !py-2 text-sm">
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Store products</caption>
            <thead>
              <tr className="border-b border-navy-100 text-xs uppercase tracking-wide text-navy-400">
                <th scope="col" className="py-2 pr-4">Product</th>
                <th scope="col" className="py-2 pr-4">Price</th>
                <th scope="col" className="py-2 pr-4">Type</th>
                <th scope="col" className="py-2 pr-4">Status</th>
                <th scope="col" className="py-2 pr-4"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-navy-400">No products yet. Create your first one.</td>
                </tr>
              )}
              {products.map((p) => (
                <tr key={p.id} className="border-b border-navy-50 text-navy-700">
                  <td className="py-3 pr-4">
                    <div className="font-medium text-navy-900">{p.name}</div>
                    {p.description ? <div className="line-clamp-1 text-xs text-navy-400">{p.description}</div> : null}
                  </td>
                  <td className="py-3 pr-4 font-semibold">${(p.price_cents / 100).toFixed(2)}</td>
                  <td className="py-3 pr-4 capitalize">{p.kind}</td>
                  <td className="py-3 pr-4">
                    <button
                      type="button"
                      disabled={!props.canWrite}
                      onClick={() => toggleActive(p)}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${p.active ? "bg-emerald-50 text-emerald-700" : "bg-navy-100 text-navy-500"}`}
                    >
                      {p.active ? "Live" : "Hidden"}
                    </button>
                  </td>
                  <td className="py-3 pr-4 text-right">
                    {props.canWrite && (
                      <span className="inline-flex gap-2">
                        <button type="button" onClick={() => startEdit(p)} className="text-navy-400 hover:text-brand-600" aria-label="Edit">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <ConfirmAction
                          message={`Delete "${p.name}"? Past orders keep their receipt.`}
                          onConfirm={() => remove(p)}
                          triggerClassName="text-navy-400 hover:text-red-600"
                        />
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-semibold text-navy-900">Recent orders</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Recent orders</caption>
            <thead>
              <tr className="border-b border-navy-100 text-xs uppercase tracking-wide text-navy-400">
                <th scope="col" className="py-2 pr-4">Buyer</th>
                <th scope="col" className="py-2 pr-4">Amount</th>
                <th scope="col" className="py-2 pr-4">Status</th>
                <th scope="col" className="py-2 pr-4">Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-navy-400">No orders yet.</td>
                </tr>
              )}
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-navy-50 text-navy-700">
                  <td className="py-3 pr-4">{o.email}</td>
                  <td className="py-3 pr-4 font-semibold">${(o.amount_cents / 100).toFixed(2)}</td>
                  <td className="py-3 pr-4">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${orderBadge(o.status)}`}>{o.status}</span>
                  </td>
                  <td className="py-3 pr-4 text-navy-400">{o.created_at.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function orderBadge(status: string): string {
  const map: Record<string, string> = {
    paid: "bg-emerald-50 text-emerald-700",
    pending: "bg-amber-50 text-amber-700",
    failed: "bg-red-50 text-red-700",
    refunded: "bg-sky-50 text-sky-700",
    canceled: "bg-navy-100 text-navy-500",
  };
  return map[status] || "bg-navy-100 text-navy-500";
}
