"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarCheck, Check, Clock, Globe, Loader2, Plus } from "lucide-react";

export interface ServiceRow {
  id: string;
  name: string;
  description: string;
  duration_min: number;
  price_cents: number;
  currency: string;
  buffer_min: number;
  active: number;
  slug: string;
}

export interface AvailabilityRow {
  id: string;
  service_id: string;
  day_of_week: number;
  start_min: number;
  end_min: number;
}

export interface BookingRow {
  id: string;
  service_id: string;
  attendee_name: string;
  attendee_email: string;
  starts_at: string;
  ends_at: string;
  status: string;
  created_at: string;
}



export function BookingManager(props: {
  initialServices: ServiceRow[];
  initialAvailability: AvailabilityRow[];
  initialBookings: BookingRow[];
}) {
  const [services] = useState<ServiceRow[]>(props.initialServices);
  const [availability, setAvailability] = useState<AvailabilityRow[]>(props.initialAvailability);
  const [bookings] = useState<BookingRow[]>(props.initialBookings);
  const [openService, setOpenService] = useState<string | null>(services[0]?.id ?? null);
  const [creating, setCreating] = useState(false);

  const serviceById = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);
  const statusColor: Record<string, string> = { confirmed: "bg-emerald-50 text-emerald-700", cancelled: "bg-red-50 text-red-700", rescheduled: "bg-amber-50 text-amber-700" };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* Column 1: services */}
      <div className="space-y-4">
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-navy-900">Services</h2>
            <button type="button" onClick={() => setCreating(!creating)} className="btn-secondary !px-3 !py-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" /> New service
            </button>
          </div>

          {creating && <ServiceForm onDone={() => setCreating(false)} />}

          {services.length === 0 && !creating ? (
            <p className="py-6 text-center text-sm text-navy-400">
              No services yet. Create a call, session or consultation.
            </p>
          ) : (
            <ul className="space-y-2">
              {services.map((svc) => {
                const windows = availability.filter((w) => w.service_id === svc.id);
                return (
                  <li key={svc.id} className="overflow-hidden rounded-xl border border-navy-100">
                    <button
                      type="button"
                      onClick={() => setOpenService(openService === svc.id ? null : svc.id)}
                      className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-navy-50"
                    >
                      <span>
                        <span className="font-medium text-navy-900">{svc.name}</span>
                        <span className="ml-2 text-xs text-navy-400">{svc.slug}</span>
                      </span>
                      <span className="flex items-center gap-3 text-sm">
                        <span className="flex items-center gap-1 text-navy-500"><Clock className="h-3.5 w-3.5" /> {svc.duration_min}m</span>
                        {svc.price_cents > 0 ? (
                          <span className="font-semibold text-navy-900">${(svc.price_cents / 100).toFixed(2)}</span>
                        ) : (
                          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">Free</span>
                        )}
                      </span>
                    </button>
                    {openService === svc.id && (
                      <div className="border-t border-navy-100 px-4 py-3">
                        <p className="text-sm text-navy-500">{svc.description || "No description"}</p>
                        <div className="mt-3">
                          <AvailabilityEditor
                            serviceId={svc.id}
                            windows={windows}
                            onReplace={(next) => {
                              setAvailability((prev) => [...prev.filter((w) => w.service_id !== svc.id), ...next]);
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Link hint */}
        <div className="card border-brand-200 bg-brand-50 p-5">
          <h3 className="flex items-center gap-2 font-semibold text-navy-900">
            <CalendarCheck className="h-4 w-4 text-brand-600" /> Share your booking link
          </h3>
          <p className="mt-1 text-sm text-navy-600">
            Add a <strong>Booking</strong> block to your bio page — visitors can book from there. Or share the direct link.
          </p>
          <Link href="/app/bio" className="btn-primary mt-3 !py-2 text-sm">
            Add booking block
          </Link>
        </div>
      </div>

      {/* Column 2: bookings */}
      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-navy-900">Upcoming &amp; recent bookings</h2>
          <Globe className="h-4 w-4 text-navy-300" />
        </div>
        {bookings.length === 0 ? (
          <p className="py-8 text-center text-sm text-navy-400">No bookings yet. Share your page to get your first one.</p>
        ) : (
          <ul className="space-y-2">
            {bookings.map((b) => {
              const svc = serviceById.get(b.service_id);
              return (
                <li key={b.id} className="rounded-xl border border-navy-100 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-navy-900">{b.attendee_name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusColor[b.status] || "bg-navy-50 text-navy-600"}`}>
                      {b.status}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-navy-500">
                    <span>{svc?.name || "Service"}</span>
                    <span>{formatWhen(b.starts_at)}</span>
                  </div>
                  <div className="text-xs text-navy-400">{b.attendee_email}</div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function ServiceForm({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({ name: "", description: "", durationMin: 30, priceCents: 0, slug: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/booking/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await res.json();
      if (j.ok) {
        window.location.reload();
      } else {
        setError(j.error?.message || "Could not create service");
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-4 rounded-xl border border-brand-200 bg-brand-50/60 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="svc-name">Name</label>
          <input
            id="svc-name"
            className="input"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, slug: f.slug || e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") }))}
            placeholder="e.g. 30-min Strategy Call"
          />
        </div>
        <div>
          <label className="label" htmlFor="svc-slug">Slug (URL)</label>
          <input id="svc-slug" className="input" required value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))} placeholder="strategy-call" />
        </div>
        <div>
          <label className="label" htmlFor="svc-duration">Duration (min)</label>
          <input id="svc-duration" className="input" type="number" min={5} max={480} required value={form.durationMin} onChange={(e) => setForm((f) => ({ ...f, durationMin: Number(e.target.value) }))} />
        </div>
        <div>
          <label className="label" htmlFor="svc-price">Price (USD)</label>
          <input id="svc-price" className="input" type="number" min={0} step={1} value={form.priceCents / 100} onChange={(e) => setForm((f) => ({ ...f, priceCents: Math.round(Number(e.target.value) * 100) }))} placeholder="0 = free" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="svc-description">Description</label>
          <textarea id="svc-description" className="input min-h-[56px]" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="What happens on this call?" />
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={saving} className="btn-primary !py-2 text-sm">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {saving ? "Creating…" : "Create service"}
        </button>
        <button type="button" onClick={onDone} className="btn-secondary !py-2 text-sm">Cancel</button>
      </div>
    </form>
  );
}

const DAY_OF_WEEK_LABEL: Record<number, string> = { 0: "Sun", 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat" };

function AvailabilityEditor(props: {
  serviceId: string;
  windows: AvailabilityRow[];
  onReplace: (next: AvailabilityRow[]) => void;
}) {
  const [days, setDays] = useState<Record<number, boolean>>(() => {
    const out: Record<number, boolean> = {};
    for (const w of props.windows) out[w.day_of_week] = true;
    return out;
  });
  const [start, setStart] = useState(() => minutesToTime(props.windows[0]?.start_min ?? 9 * 60));
  const [end, setEnd] = useState(() => minutesToTime(props.windows[0]?.end_min ?? 10 * 60));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    const windows = Object.entries(days)
      .filter(([, on]) => on)
      .map(([dow]) => ({ dayOfWeek: Number(dow), startMin: timeToMinutes(start), endMin: timeToMinutes(end) }));
    setSaving(true);
    setSaved(false);
    setErr("");
    try {
      const res = await fetch(`/api/booking/services/${props.serviceId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ windows }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      } else {
        const j = await res.json().catch(() => ({}));
        setErr(j.error?.message || "Could not save availability");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-500">Repeat availability</div>
      <div className="flex flex-wrap gap-1.5">
        {[0, 1, 2, 3, 4, 5, 6].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDays((prev) => ({ ...prev, [d]: !prev[d] }))}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
              days[d] ? "bg-brand-600 text-white" : "bg-navy-50 text-navy-500 hover:bg-navy-100"
            }`}
          >
            {DAY_OF_WEEK_LABEL[d]}
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div>
          <span className="label">From</span>
          <input className="input" type="time" aria-label="From" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <span className="label">To</span>
          <input className="input" type="time" aria-label="To" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>
      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
      <button type="button" onClick={save} disabled={saving} className="btn-primary mt-3 !py-2 text-sm">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        {saving ? "Saving…" : saved ? "Saved" : "Save availability"}
      </button>
    </div>
  );
}

function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}