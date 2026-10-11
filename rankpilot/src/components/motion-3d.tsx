"use client";

import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { useRef, type PointerEvent, type ReactNode } from "react";
import { cn } from "@/components/ui";

const SPRING = { stiffness: 150, damping: 20, mass: 0.4 };

/**
 * Fades and lifts content into view as it scrolls onto the screen. Falls back
 * to a plain render when the visitor prefers reduced motion.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 24,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Wraps children in a card that tilts in 3D space toward the pointer, with a
 * moving light sheen and a shadow that deepens as the card lifts.
 */
export function Tilt({
  children,
  className,
  intensity = 18,
}: {
  children: ReactNode;
  className?: string;
  intensity?: number;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);

  const rotateX = useSpring(useTransform(py, [0, 1], [intensity, -intensity]), SPRING);
  const rotateY = useSpring(useTransform(px, [0, 1], [-intensity, intensity]), SPRING);
  const shadowY = useSpring(useTransform(py, [0, 1], [14, 30]), SPRING);
  const boxShadow = useMotionTemplate`0 ${shadowY}px 46px -12px rgba(15,23,42,0.3)`;
  const sheenX = useTransform(px, [0, 1], ["0%", "100%"]);
  const sheenY = useTransform(py, [0, 1], ["0%", "100%"]);
  const sheen = useMotionTemplate`radial-gradient(360px circle at ${sheenX} ${sheenY}, rgba(255,255,255,0.45), transparent 62%)`;

  function track(event: PointerEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    px.set((event.clientX - rect.left) / rect.width);
    py.set((event.clientY - rect.top) / rect.height);
  }

  function reset() {
    px.set(0.5);
    py.set(0.5);
  }

  if (reduce) return <div className={className}>{children}</div>;

  return (
    <div className="group [perspective:1200px]">
      <motion.div
        ref={ref}
        onPointerMove={track}
        onPointerLeave={reset}
        style={{ rotateX, rotateY, boxShadow, transformStyle: "preserve-3d" }}
        className={cn("relative", className)}
      >
        {children}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: sheen }}
        />
      </motion.div>
    </div>
  );
}

/**
 * Staggers direct children onto the screen. Each child should be a `StaggerItem`.
 */
export function Stagger({
  children,
  className,
  gap = 0.08,
}: {
  children: ReactNode;
  className?: string;
  gap?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.15 }}
      variants={{ show: { transition: { staggerChildren: gap } } }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  y = 18,
}: {
  children: ReactNode;
  className?: string;
  y?: number;
}) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y },
        show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Continuously floats its children on the Z axis and adds pointer-driven
 * parallax so the hero panel reads as a floating object, not a flat card.
 */
export function FloatPanel({
  children,
  className,
  depth = 30,
  distance = 16,
  duration = 6,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  depth?: number;
  distance?: number;
  duration?: number;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);

  const rotateY = useSpring(useTransform(mx, [0, 1], [-depth, depth]), SPRING);
  const rotateX = useSpring(useTransform(my, [0, 1], [depth, -depth]), SPRING);

  function track(event: PointerEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    mx.set((event.clientX - rect.left) / rect.width);
    my.set((event.clientY - rect.top) / rect.height);
  }

  function reset() {
    mx.set(0.5);
    my.set(0.5);
  }

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className="[perspective:1400px]">
      <motion.div
        ref={ref}
        onPointerMove={track}
        onPointerLeave={reset}
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        animate={{ y: [0, -distance, 0] }}
        transition={{ duration, repeat: Infinity, ease: "easeInOut", delay }}
        className={className}
      >
        {children}
      </motion.div>
    </div>
  );
}

/**
 * Layers content at a fixed Z offset inside a `FloatPanel`, so badges and rows
 * pop toward the viewer for real depth.
 */
export function Layer({
  children,
  z = 0,
  className,
}: {
  children: ReactNode;
  z?: number;
  className?: string;
}) {
  return (
    <div className={className} style={{ transform: `translateZ(${z}px)` }}>
      {children}
    </div>
  );
}

/**
 * Translates its children vertically as the section scrolls, creating a sense
 * of depth between the foreground and background layers.
 */
export function Parallax({
  children,
  className,
  offset = 60,
}: {
  children: ReactNode;
  className?: string;
  offset?: number;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [offset, -offset]);
  const smoothY = useSpring(y, { stiffness: 120, damping: 30, mass: 0.5 });

  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div ref={ref} style={{ y: smoothY }} className={className}>
      {children}
    </motion.div>
  );
}

/**
 * An absolutely-positioned chip that bobs forever, used to sprinkle depth
 * accents (labels, badges) around a section.
 */
export function FloatingChip({
  children,
  className,
  delay = 0,
  distance = 10,
  duration = 5,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  distance?: number;
  duration?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={cn("absolute", className)}>{children}</div>;

  return (
    <motion.div
      className={cn("absolute", className)}
      animate={{ y: [0, -distance, 0] }}
      transition={{ duration, repeat: Infinity, ease: "easeInOut", delay }}
    >
      {children}
    </motion.div>
  );
}

/** Convenience: a spring-backed MotionValue for callers that need one. */
export function useTiltValue(initial: number): MotionValue<number> {
  return useSpring(initial, SPRING);
}
