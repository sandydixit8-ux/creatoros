"use client";

import { motion } from "framer-motion";
import { FloatPanel, Layer } from "@/components/motion-3d";

const BARS = [
  { label: "Technical SEO", value: 94, tone: "from-brand-500 to-brand-300" },
  { label: "AEO readiness", value: 88, tone: "from-violet-500 to-violet-300" },
  { label: "GEO signals", value: 81, tone: "from-emerald-500 to-emerald-300" },
];

const BADGES = [
  { text: "SEO 98", z: 70, pos: "-left-6 top-8", tone: "bg-brand-600 text-white" },
  { text: "AEO ✓", z: 54, pos: "-right-5 top-1/3", tone: "bg-white text-violet-700 ring-1 ring-violet-200" },
  { text: "AI cited", z: 66, pos: "-right-8 bottom-16", tone: "bg-white text-emerald-700 ring-1 ring-emerald-200" },
  { text: "#1 keyword", z: 44, pos: "-left-7 bottom-10", tone: "bg-ink-900 text-white" },
];

export function FloatingHero() {
  return (
    <div className="relative mx-auto w-full max-w-sm [perspective:1400px]">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-10 -z-10 rounded-[3rem] bg-brand-400/20 blur-3xl"
      />
      <FloatPanel className="relative [transform-style:preserve-3d]">
        {/* Main dashboard card */}
        <Layer z={0} className="relative">
          <div className="card overflow-hidden p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-ink-500">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Visibility overview
              </div>
              <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-medium text-ink-500">
                live
              </span>
            </div>

            <div className="mt-5 flex items-center gap-5">
              <ScoreRing value={92} />
              <div>
                <div className="text-sm font-semibold text-ink-900">Growth score</div>
                <p className="mt-1 text-xs leading-5 text-ink-500">
                  12 high-value fixes queued this week. All measurable, none guessed.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {BARS.map((bar, index) => (
                <div key={bar.label}>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="font-medium text-ink-700">{bar.label}</span>
                    <span className="text-ink-400">{bar.value}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-ink-100">
                    <motion.div
                      className={`h-full rounded-full bg-gradient-to-r ${bar.tone}`}
                      initial={{ width: 0 }}
                      whileInView={{ width: `${bar.value}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, delay: 0.2 + index * 0.15, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Layer>

        {/* Floating depth badges */}
        {BADGES.map((badge) => (
          <Layer key={badge.text} z={badge.z} className={`absolute ${badge.pos}`}>
            <div
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold shadow-lg shadow-ink-900/10 ${badge.tone}`}
            >
              {badge.text}
            </div>
          </Layer>
        ))}
      </FloatPanel>
    </div>
  );
}

function ScoreRing({ value }: { value: number }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - value / 100);

  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle cx="40" cy="40" r={radius} fill="none" stroke="var(--color-ink-100)" strokeWidth="8" />
        <motion.circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="var(--color-brand-600)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          whileInView={{ strokeDashoffset: offset }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-xl font-bold text-ink-950">
        {value}
      </div>
    </div>
  );
}
