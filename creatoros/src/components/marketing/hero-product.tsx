"use client";

import { useEffect, useRef, useState } from "react";
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type Variants,
} from "framer-motion";
import { CalendarCheck, Link2, Mail, Sparkles, TrendingUp, Wallet } from "lucide-react";

const STATS = [
  { label: "Views", target: 12000, format: (n: number) => `${Math.round(n / 1000)}k` },
  { label: "Leads", target: 318, format: (n: number) => `${Math.round(n)}` },
  { label: "Revenue", target: 8400, format: (n: number) => `$${(n / 1000).toFixed(1)}k` },
];

const SIDEBAR = [Link2, TrendingUp, CalendarCheck, Mail, Wallet];

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.12 } },
};

const rise: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 110, damping: 18 } },
};

function Counter({ target, format, play }: { target: number; format: (n: number) => string; play: boolean }) {
  const [value, setValue] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!play || reduced) return;
    const controls = animate(0, target, {
      duration: 1.2,
      ease: "easeOut",
      onUpdate: (v) => setValue(v),
    });
    return () => controls.stop();
  }, [play, target, reduced]);

  return <>{format(reduced ? target : value)}</>;

}

export function HeroProduct() {
  const frame = useRef<HTMLDivElement>(null);
  const inView = useInView(frame, { once: true, amount: 0.35 });
  const reduced = useReducedMotion();

  const px = useMotionValue(0);
  const py = useMotionValue(0);

  const rotateY = useSpring(useTransform(px, [-1, 1], [-13, 13]), { stiffness: 140, damping: 20 });
  const rotateX = useSpring(useTransform(py, [-1, 1], [11, -11]), { stiffness: 140, damping: 20 });
  const floatX = useSpring(useTransform(px, [-1, 1], [-18, 18]), { stiffness: 120, damping: 20 });
  const floatY = useSpring(useTransform(py, [-1, 1], [-12, 12]), { stiffness: 120, damping: 20 });

  function handleMove(e: React.PointerEvent<HTMLDivElement>) {
    if (reduced || typeof window === "undefined" || !window.matchMedia("(pointer: fine)").matches) return;
    const rect = frame.current?.getBoundingClientRect();
    if (!rect) return;
    px.set(((e.clientX - rect.left) / rect.width) * 2 - 1);
    py.set(((e.clientY - rect.top) / rect.height) * 2 - 1);
  }

  function handleLeave() {
    px.set(0);
    py.set(0);
  }

  const floatLoop = {
    y: [0, -10, 0],
  };

  return (
    <div
      ref={frame}
      className="relative"
      style={{ perspective: 1400 }}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
    >
      <motion.div
        variants={container}
        initial="hidden"
        animate={inView ? "show" : "hidden"}
        className="relative mx-auto max-w-[600px] will-change-transform"
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      >
        <div
          aria-hidden
          className="absolute -inset-8 -z-10 rounded-[48px] bg-gradient-to-br from-brand-500/25 via-transparent to-cyan-400/20 blur-3xl"
        />

        <motion.div variants={rise} className="overflow-hidden rounded-2xl border border-white/10 bg-night-800/90 shadow-card">
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
              {SIDEBAR.map((Icon, i) => {
                const tone = ["text-brand-400", "text-cyan-300", "text-emerald-300", "text-blue-300", "text-amber-300"][i];
                return <Icon key={i} className={`h-4 w-4 ${tone}`} />;
              })}
            </div>

            <div className="flex-1 p-5">
              <div className="grid grid-cols-3 gap-3">
                {STATS.map((s) => (
                  <div key={s.label} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                    <div className="text-[11px] font-medium text-ink-muted">{s.label}</div>
                    <div className="mt-1 text-lg font-semibold tabular-nums text-ink">
                      <Counter target={s.target} format={s.format} play={inView} />
                    </div>
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
                  <motion.path
                    d="M0 72 C40 64 60 50 90 52 S140 60 170 42 S220 28 250 26 S290 14 300 10 L300 90 L0 90 Z"
                    fill="url(#heroArea)"
                    initial={{ opacity: 0 }}
                    animate={inView ? { opacity: 1 } : { opacity: 0 }}
                    transition={{ duration: 1.2, delay: 0.5, ease: "easeOut" }}
                  />
                  <motion.path
                    d="M0 72 C40 64 60 50 90 52 S140 60 170 42 S220 28 250 26 S290 14 300 10"
                    fill="none"
                    stroke="url(#heroLine)"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={inView ? { pathLength: 1 } : { pathLength: 0 }}
                    transition={{ duration: 1.5, delay: 0.5, ease: "easeInOut" }}
                  />
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
        </motion.div>

        <motion.div
          variants={rise}
          style={{ x: floatX, y: floatY, z: 70 }}
          className="absolute -right-3 -top-7 hidden sm:block"
        >
          <motion.div
            aria-hidden
            animate={reduced ? undefined : floatLoop}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
            className="w-44 rounded-2xl border border-cyan-300/25 bg-night-800/95 p-4 shadow-card"
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-cyan-300" />
              <span className="text-xs font-semibold text-ink">+12% followers</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">Growing steadily across reels and posts.</p>
          </motion.div>
        </motion.div>

        <motion.div
          variants={rise}
          style={{ x: floatX, y: floatY, z: 70 }}
          className="absolute -bottom-8 -left-4 hidden sm:block"
        >
          <motion.div
            aria-hidden
            animate={reduced ? undefined : { y: [0, -10, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 3.5 }}
            className="w-48 rounded-2xl border border-brand-400/25 bg-night-800/95 p-4 shadow-card"
          >
            <div className="flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-brand-300" />
              <span className="text-xs font-semibold text-ink">Booking confirmed</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">30-min strategy call · 2:00 PM</p>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}
