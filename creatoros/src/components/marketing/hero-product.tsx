"use client";

import { useRef, useState } from "react";
import { CalendarCheck, Link2, Mail, Sparkles, TrendingUp, Wallet } from "lucide-react";

const STATS = [
  { label: "Views", value: "12.4k" },
  { label: "Leads", value: "318" },
  { label: "Revenue", value: "$1,924" },
];

export function HeroProduct() {
  const frame = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = frame.current;
    if (!el) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ rx: -y * 5, ry: x * 8 });
  }

  function onPointerLeave() {
    setTilt({ rx: 0, ry: 0 });
  }

  return (
    <div className="relative [perspective:1400px]" ref={frame} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}>
      <div
        className="relative mx-auto max-w-[600px] transition-transform duration-300 ease-out will-change-transform [transform-style:preserve-3d]"
        style={{ transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)` }}
      >
        <div aria-hidden className="absolute -inset-8 -z-10 rounded-[48px] bg-gradient-to-br from-brand-500/25 via-transparent to-cyan-400/20 blur-3xl" />

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-night-800/90 shadow-card">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="flex h-3.5 w-3.5 rounded-full bg-rose-400/80" />
              <span className="flex h-3.5 w-3.5 rounded-full bg-amber-400/80" />
              <span className="flex h-3.5 w-3.5 rounded-full bg-emerald-400/80" />
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-ink-muted">
              Sample data
            </span>
          </div>

          <div className="flex">
            <div aria-hidden className="hidden w-12 flex-col items-center gap-4 border-r border-white/10 py-5 sm:flex">
              <Link2 className="h-4 w-4 text-brand-400" />
              <TrendingUp className="h-4 w-4 text-cyan-300" />
              <CalendarCheck className="h-4 w-4 text-emerald-300" />
              <Mail className="h-4 w-4 text-blue-300" />
              <Wallet className="h-4 w-4 text-amber-300" />
            </div>

            <div className="flex-1 p-5">
              <div className="grid grid-cols-3 gap-3">
                {STATS.map((s) => (
                  <div key={s.label} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                    <div className="text-[11px] font-medium text-ink-muted">{s.label}</div>
                    <div className="mt-1 text-lg font-semibold tabular-nums text-ink">{s.value}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-medium text-ink-muted">Audience growth</div>
                  <div className="text-[11px] font-medium text-cyan-300">+18% this month</div>
                </div>
                <svg viewBox="0 0 300 90" aria-hidden className="mt-3 h-24 w-full">
                  <defs>
                    <linearGradient id="heroArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="heroLine" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#8b5cf6" />
                      <stop offset="100%" stopColor="#22d3ee" />
                    </linearGradient>
                  </defs>
                  <path d="M0 72 C40 64 60 50 90 52 S140 60 170 42 S220 28 250 26 S290 14 300 10 L300 90 L0 90 Z" fill="url(#heroArea)" />
                  <path d="M0 72 C40 64 60 50 90 52 S140 60 170 42 S220 28 250 26 S290 14 300 10" fill="none" stroke="url(#heroLine)" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>

              <div className="mt-4 flex items-start gap-3 rounded-xl border border-brand-500/25 bg-brand-500/10 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/25 text-brand-300">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-ink">AI Strategy Coach</div>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-secondary">
                    Publish your Tuesday reel — it is your strongest slot for reaching new followers this week.
                  </p>
                </div>
                <div className="ml-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-emerald-400/70 text-xs font-semibold text-emerald-300">
                  84
                </div>
              </div>
            </div>
          </div>
        </div>

        <div aria-hidden className="hero-float absolute -right-3 -top-7 hidden w-44 rounded-2xl border border-cyan-300/25 bg-night-800/95 p-4 shadow-card sm:block">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-cyan-300" />
            <span className="text-xs font-semibold text-ink">+12% followers</span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">Growing steadily across reels and posts.</p>
        </div>

        <div aria-hidden className="hero-float hero-float-delay absolute -bottom-8 -left-4 hidden w-48 rounded-2xl border border-brand-400/25 bg-night-800/95 p-4 shadow-card sm:block">
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-brand-300" />
            <span className="text-xs font-semibold text-ink">Booking confirmed</span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">30-min strategy call · 2:00 PM</p>
        </div>
      </div>
    </div>
  );
}