"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import { RotateCcw } from "lucide-react";
import { useCallback, useState } from "react";

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PARTICLES = (() => {
  const rnd = mulberry32(20260118);
  return Array.from({ length: 26 }, () => ({
    left: `${(rnd() * 100).toFixed(2)}%`,
    top: `${(rnd() * 100).toFixed(2)}%`,
    delay: -Number((rnd() * 9).toFixed(2)),
    duration: Number((7 + rnd() * 6).toFixed(2)),
  }));
})();

const CREATOR = "Creator".split("");
const EASE: [number, number, number, number] = [0.2, 0.8, 0.2, 1];
const CAM_EASE: [number, number, number, number] = [0.16, 0.7, 0.2, 1];

const LETTER_START = 1.95;
const LETTER_STEP = 0.07;

const fadeUp = (delay: number): Variants => ({
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, delay, ease: EASE } },
});

const badgeVariants: Variants = {
  hidden: { opacity: 0, scale: 0.55 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.9, delay: 1, ease: EASE } },
};

const cVariants: Variants = {
  hidden: { opacity: 0, scale: 0.6 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.5, delay: 1.25, ease: "easeOut" } },
};

const letterVariants = (i: number): Variants => ({
  hidden: { opacity: 0, y: "0.3em", filter: "blur(8px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.62, delay: LETTER_START + i * LETTER_STEP, ease: EASE },
  },
});

const osVariants: Variants = {
  hidden: { opacity: 0, y: "0.28em", filter: "blur(8px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.7, delay: LETTER_START + CREATOR.length * LETTER_STEP + 0.07, ease: EASE },
  },
};

const underlineVariants: Variants = {
  hidden: { opacity: 0, scaleX: 0 },
  show: { opacity: 1, scaleX: 1, transition: { duration: 0.72, delay: 3.05, ease: EASE } },
};

const glowVariants: Variants = {
  hidden: { opacity: 0, scale: 0.85 },
  show: {
    opacity: 0.55,
    scale: 1,
    transition: { duration: 1.8, delay: 0.9, ease: "easeOut" },
  },
};

const TRAILS = [
  "M-60,250 C 300,150 500,500 850,420 S 1300,250 1660,360",
  "M-60,650 C 300,760 520,400 860,520 S 1320,720 1660,600",
  "M-60,450 C 400,300 700,650 1000,480 S 1400,380 1660,470",
];

export function BrandReveal({ className = "" }: { className?: string }) {
  const reduce = useReducedMotion();
  const [runId, setRunId] = useState(0);
  const [portrait, setPortrait] = useState(false);
  const replay = useCallback(() => setRunId((v) => v + 1), []);
  const initial = reduce ? false : "hidden";

  return (
    <div className={`flex w-full flex-col items-center gap-4 ${className}`}>
      <div
        className={`relative overflow-hidden rounded-[18px] bg-night-950 shadow-[0_30px_90px_-20px_rgba(109,40,217,0.55)] ring-1 ring-white/[0.06] ${
          portrait ? "w-full max-w-[520px]" : "w-full"
        }`}
        style={{ aspectRatio: portrait ? "9 / 16" : "16 / 9" }}
      >
        <div key={runId} className="absolute inset-0 overflow-hidden">
          {/* background */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 90% at 50% 42%, #171e35 0%, #0b1020 52%, #05070f 100%)",
            }}
          />

          <motion.div
            aria-hidden
            className="absolute left-[8%] top-[6%] h-[60%] w-[46%] rounded-full opacity-55 mix-blend-screen blur-[70px]"
            style={{
              background:
                "radial-gradient(circle, #8b5cf6, transparent 70%)",
            }}
            animate={reduce ? undefined : { x: [0, 20, 0], y: [0, -24, 0], scale: [1, 1.12, 1] }}
            transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            aria-hidden
            className="absolute bottom-[2%] right-[6%] h-[54%] w-[40%] rounded-full opacity-35 mix-blend-screen blur-[70px]"
            style={{
              background: "radial-gradient(circle, #67e8f9, transparent 70%)",
            }}
            animate={reduce ? undefined : { x: [0, -22, 0], y: [0, -18, 0], scale: [1, 1.14, 1] }}
            transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* light trails */}
          <svg
            className="absolute inset-0 h-full w-full opacity-90"
            viewBox="0 0 1600 900"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden
          >
            <defs>
              <linearGradient id="brand-reveal-trail" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#8b5cf6" />
                <stop offset="1" stopColor="#67e8f9" />
              </linearGradient>
              <filter id="brand-reveal-glow">
                <feGaussianBlur stdDeviation="4" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <g filter="url(#brand-reveal-glow)" stroke="url(#brand-reveal-trail)" strokeWidth={2.4} fill="none" strokeLinecap="round">
              {TRAILS.map((d, i) => (
                <motion.path
                  key={i}
                  d={d}
                  strokeDasharray="220 1700"
                  initial={{ strokeDashoffset: 1900 }}
                  animate={reduce ? { strokeDashoffset: 1900 } : { strokeDashoffset: -260 }}
                  transition={{ duration: 7 + i * 2, repeat: Infinity, ease: "linear", delay: -i * 2 }}
                  style={{ opacity: 1 - i * 0.2 }}
                />
              ))}
            </g>
          </svg>

          {/* dust */}
          <div className="absolute inset-0" aria-hidden>
            {PARTICLES.map((p, i) => (
              <motion.i
                key={i}
                className="absolute h-[3px] w-[3px] rounded-full bg-brand-400 shadow-[0_0_8px_#a78bfa]"
                style={{ left: p.left, top: p.top }}
                animate={reduce ? { opacity: 0.4 } : { y: [0, -18, 0], opacity: [0.2, 0.8, 0.2] }}
                transition={{ duration: p.duration, repeat: Infinity, ease: "easeInOut", delay: p.delay }}
              />
            ))}
          </div>

          {/* glow behind logo */}
          <motion.div
            aria-hidden
            className="absolute left-1/2 top-[44%] h-[52%] w-[60%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[50px]"
            style={{
              background:
                "radial-gradient(circle, rgba(139,92,246,0.75), rgba(103,232,249,0.18) 55%, transparent 72%)",
            }}
            initial={initial}
            animate="show"
            variants={glowVariants}
          />

          {/* camera push */}
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            initial={{ scale: reduce ? 1 : 1.1 }}
            animate={{ scale: 1 }}
            transition={{ duration: reduce ? 0 : 10, ease: CAM_EASE }}
          >
            <motion.div
              className="flex flex-col items-center gap-[clamp(10px,1.4vw,20px)] px-[6%] text-center"
              initial={initial}
              animate="show"
            >
              <motion.div
                className="grid aspect-square place-items-center rounded-[26%] bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-[0_18px_60px_-12px_rgba(139,92,246,0.9)]"
                style={{
                  width: "clamp(74px, 8.4vw, 132px)",
                  fontSize: "clamp(34px, 4.1vw, 66px)",
                  fontWeight: 800,
                  lineHeight: 1,
                }}
                variants={badgeVariants}
              >
                <motion.span variants={cVariants} className="block">
                  C
                </motion.span>
              </motion.div>

              <div
                className="flex font-semibold leading-none tracking-[-0.02em]"
                style={{ fontSize: "clamp(40px, 7.4vw, 116px)" }}
              >
                <span className="inline-flex text-ink">
                  {CREATOR.map((ch, i) => (
                    <motion.span key={i} className="inline-block" variants={letterVariants(i)}>
                      {ch}
                    </motion.span>
                  ))}
                </span>
                <motion.span
                  className="inline-block bg-gradient-to-r from-brand-400 to-cyan-300 bg-clip-text text-transparent"
                  variants={osVariants}
                >
                  OS
                </motion.span>
              </div>

              <motion.div
                className="h-0.5 origin-center rounded-full shadow-[0_0_18px_rgba(103,232,249,0.7)]"
                style={{
                  width: "clamp(160px, 26vw, 420px)",
                  background:
                    "linear-gradient(90deg, transparent, #a78bfa, #67e8f9, transparent)",
                }}
                variants={underlineVariants}
              />

              <motion.div
                className="font-medium text-ink"
                style={{ fontSize: "clamp(15px, 2vw, 30px)" }}
                variants={fadeUp(3.48)}
              >
                Create. Grow. Sell. Automate.
              </motion.div>
              <motion.div
                className="text-ink-secondary"
                style={{ fontSize: "clamp(13px, 1.7vw, 24px)" }}
                variants={fadeUp(4.08)}
              >
                All in One Place.
              </motion.div>
              <motion.div
                className="mt-[clamp(6px,0.8vw,14px)] font-semibold text-ink"
                style={{ fontSize: "clamp(13px, 1.6vw, 22px)" }}
                variants={fadeUp(4.78)}
              >
                Explore CreatorOS
              </motion.div>
              <motion.a
                href="https://usecreatoros.co/"
                target="_blank"
                rel="noreferrer"
                className="text-brand-400"
                style={{ fontSize: "clamp(12px, 1.5vw, 20px)" }}
                variants={fadeUp(5.3)}
              >
                https://usecreatoros.co/
              </motion.a>
            </motion.div>
          </motion.div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2.5">
        <button
          type="button"
          onClick={replay}
          className="inline-flex items-center gap-2 rounded-[10px] border border-white/15 bg-white/5 px-4 py-2 text-[13px] font-semibold text-ink transition-colors hover:bg-white/10"
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
          Replay
        </button>
        <button
          type="button"
          onClick={() => setPortrait((v) => !v)}
          className="rounded-[10px] border border-white/15 bg-white/5 px-4 py-2 text-[13px] font-semibold text-ink transition-colors hover:bg-white/10"
        >
          {portrait ? "16:9" : "9:16"}
        </button>
        <span className="text-xs text-ink-muted">
          Screen-record the dark frame only (controls are outside it).
        </span>
      </div>
    </div>
  );
}
