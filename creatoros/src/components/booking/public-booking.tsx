"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { SITE_URL } from "@/lib/constants";

export interface PublicBookingService {
  id: string;
  name: string;
  description: string;
  durationMin: number;
  priceCents: number;
  currency: string;
  bufferMin: number;
  slug: string;
}

export interface PublicWindow {
  day_of_week: number;
  start_min: number;
  end_min: number;
}

interface Slot {
  start: string;
  end: string;
  label: string;
}

export function PublicBookingClient(props: {
  username: string;
  pageSlug: string;
  service: PublicBookingService;
  windows: PublicWindow[];
  ownerTz: string;
  creatorName: string;
}) {
  const { username, service } = props;
  const requestorTz = useMemo(() => guessTimezone(), []);
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slotsData, setSlotsData] = useState<{ date: string; slots: Slot[] } | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", email: "", notes: "" });
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  const slots = useMemo(
    () => (slotsData && selectedDate && slotsData.date === selectedDate ? slotsData.slots : []),
    [slotsData, selectedDate]
  );
  const loadingSlots = Boolean(selectedDate) && (!slotsData || slotsData.date !== selectedDate);
  const activeSlot = selectedSlot && slots.some((s) => s.start === selectedSlot) ? selectedSlot : null;

  useEffect(() => {
    fetch(`${SITE_URL}/api/booking/slots?username=${encodeURIComponent(username)}&serviceSlug=${encodeURIComponent(service.slug)}&tz=${encodeURIComponent(requestorTz)}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          setDates(j.data.dates as string[]);
        } else {
          setMsg(j.error?.message || "Could not load availability");
          setState("error");
        }
      })
      .catch(() => setMsg("Could not load availability"))
      .finally(() => setLoading(false));
  }, [username, service.slug, requestorTz]);

  useEffect(() => {
    if (!selectedDate) return;
    let cancelled = false;
    fetch(`${SITE_URL}/api/booking/slots?username=${encodeURIComponent(username)}&serviceSlug=${encodeURIComponent(service.slug)}&date=${selectedDate}&tz=${encodeURIComponent(requestorTz)}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        setSlotsData({ date: selectedDate, slots: j.ok ? (j.data.slots as Slot[]) : [] });
      })
      .catch(() => {
        if (!cancelled) setSlotsData({ date: selectedDate, slots: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDate, username, service.slug, requestorTz]);

  async function book(e: React.FormEvent) {
    e.preventDefault();
    if (!activeSlot) return;
    setState("loading");
    try {
      const res = await fetch(`${SITE_URL}/api/booking/slots/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          serviceSlug: service.slug,
          start: activeSlot,
          attendeeName: form.name,
          attendeeEmail: form.email,
          timezone: requestorTz,
          notes: form.notes,
        }),
      });
      const j = await res.json();
      if (j.ok) {
        setState("done");
        setMsg(j.data.message);
      } else {
        setState("error");
        setMsg(j.error?.message || "Could not book this time. Try another slot.");
      }
    } catch {
      setState("error");
      setMsg("Network error. Please try again.");
    }
  }

  if (state === "done") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-50/50 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-soft">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <Check className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-navy-950">You&apos;re booked!</h1>
          <p className="mt-2 text-sm text-navy-600">{msg}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-50/50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-navy-950">Book with {props.creatorName}</h1>
          <p className="mt-1 text-sm text-navy-500">
            {service.name} · {service.durationMin} min
            {service.priceCents > 0 ? ` · $${service.priceCents / 100} ${service.currency.toUpperCase()}` : " · Free"}
          </p>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* Calendar */}
          <div className="card p-5">
            <h2 className="mb-4 text-sm font-semibold text-navy-800">1. Pick a date</h2>
            {loading ? (
              <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-brand-500" /></div>
            ) : (
              <div className="grid max-h-[320px] grid-cols-3 gap-2 overflow-y-auto">
                {dates.map((d) => {
                  const label = fmtDate(d);
                  const active = d === selectedDate;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setSelectedDate(d)}
                      className={`rounded-xl border px-2 py-2 text-center text-xs transition ${
                        active ? "border-brand-500 bg-brand-50 font-semibold text-brand-700" : "border-navy-100 text-navy-600 hover:border-brand-300"
                      }`}
                    >
                      <span className="block font-medium">{label.day}</span>
                      <span className="block opacity-70">{label.date}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Slots + form */}
          <div className="space-y-4">
            <div className="card p-5">
              <h2 className="mb-3 text-sm font-semibold text-navy-800">2. Choose a time</h2>
              {!selectedDate ? (
                <p className="py-6 text-center text-sm text-navy-400">Select a date first.</p>
              ) : loadingSlots ? (
                <div className="flex h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-brand-500" /></div>
              ) : slots.length === 0 ? (
                <p className="py-6 text-center text-sm text-navy-400">No open slots on this day.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {slots.map((s) => (
                    <button
                      key={s.start}
                      type="button"
                      onClick={() => setSelectedSlot(s.start)}
                      className={`rounded-xl border px-3 py-2 text-sm transition ${
                        activeSlot === s.start ? "border-brand-500 bg-brand-600 text-white" : "border-navy-100 text-navy-700 hover:border-brand-300"
                      }`}
                    >
                      {timeLabel(s.label)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {activeSlot && (
              <form onSubmit={book} className="card p-5">
                <h2 className="mb-3 text-sm font-semibold text-navy-800">3. Your details</h2>
                <div className="space-y-3">
                  <input
                    className="input"
                    placeholder="Your name"
                    aria-label="Your name"
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                  <input
                    className="input"
                    placeholder="Email for confirmation"
                    aria-label="Email for confirmation"
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  />
                  <textarea
                    className="input min-h-[64px]"
                    placeholder="Anything to prep for the call? (optional)"
                    aria-label="Notes for the call (optional)"
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  />
                  {state === "error" && <p className="text-xs text-red-600">{msg}</p>}
                  <button type="submit" disabled={state === "loading"} className="btn-primary w-full py-2.5">
                    {state === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {state === "loading" ? "Booking…" : `Confirm booking${service.priceCents > 0 ? ` · $${service.priceCents / 100}` : ""}`}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-navy-400">
          Shown in your timezone ({requestorTz}). You&apos;ll get a confirmation email.
        </p>
      </div>
    </div>
  );
}

function timeLabel(label: string): string {
  // label like "Wed, Sep 25, 3:00 PM"
  const m = label.match(/(\d{1,2}):(\d{2}) (AM|PM)/i);
  if (!m) return label;
  return `${m[1]}:${m[2]} ${m[3]}`;
}

function fmtDate(isoDay: string): { day: string; date: string } {
  const [y, m, d] = isoDay.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(date);
  const dateStr = `${m}/${d}`;
  return { day, date: dateStr };
}

function guessTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}