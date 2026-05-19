"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";

// ── Scroll reveal (IntersectionObserver) ─────────────
export function useReveal({
  threshold = 0.15,
  rootMargin = "0px 0px -10% 0px",
  once = true,
} = {}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      el.classList.add("is-in");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            el.classList.add("is-in");
            if (once) io.unobserve(el);
          } else if (!once) {
            el.classList.remove("is-in");
          }
        }
      },
      { threshold, rootMargin }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold, rootMargin, once]);
  return ref;
}

// ── Reveal wrapper with staggered children ───────────
export function Reveal({
  as: Tag = "div",
  stagger = 80,
  delay = 0,
  className = "",
  children,
  ...rest
}: {
  as?: React.ElementType;
  stagger?: number;
  delay?: number;
  className?: string;
  children: React.ReactNode;
  [key: string]: any;
}) {
  const ref = useReveal();
  const arr = React.Children.toArray(children);
  return (
    <Tag ref={ref} data-reveal="" className={className} {...rest}>
      {arr.map((c, i) =>
        React.isValidElement(c)
          ? React.cloneElement(c as React.ReactElement<any>, {
              style: {
                ...((c as React.ReactElement<any>).props.style || {}),
                "--rev-d": `${delay + i * stagger}ms`,
              } as React.CSSProperties,
              key: (c as React.ReactElement<any>).key ?? i,
            })
          : c
      )}
    </Tag>
  );
}

// ── Single-element reveal ────────────────────────────
export function RevealOne({
  as: Tag = "div",
  delay = 0,
  className = "",
  children,
  ...rest
}: {
  as?: React.ElementType;
  delay?: number;
  className?: string;
  children: React.ReactNode;
  [key: string]: any;
}) {
  const ref = useReveal();
  return (
    <Tag
      ref={ref}
      className={`reveal ${className}`}
      style={{ transitionDelay: `${delay}ms` } as React.CSSProperties}
      {...rest}
    >
      {children}
    </Tag>
  );
}

// ── Scrolled state tracker ───────────────────────────
export function useScrolled(threshold = 8) {
  const [s, setS] = useState(false);
  useEffect(() => {
    const f = () => setS(window.scrollY > threshold);
    f();
    window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, [threshold]);
  return s;
}

// ── Active section from scroll position ──────────────
export function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0] || "");
  useEffect(() => {
    if (!ids.length) return;
    const els = ids
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (a.target as HTMLElement).offsetTop - (b.target as HTMLElement).offsetTop);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: 0 }
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [ids.join(",")]);
  return active;
}

// ── Animated counter ─────────────────────────────────
export function useCounter(
  target: number,
  { duration = 1400, start = 0 } = {}
) {
  const ref = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(start);
  const startedRef = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !startedRef.current) {
          startedRef.current = true;
          const t0 = performance.now();
          const tick = (now: number) => {
            const t = Math.min(1, (now - t0) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            setValue(start + (target - start) * eased);
            if (t < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          io.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [target, duration, start]);
  const text =
    String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return { ref, value, text };
}

// ── Auto-advancing index with progress ───────────────
export function useAutoIndex(
  length: number,
  { interval = 5500, paused = false } = {}
): [number, (n: number) => void, number] {
  const [i, setI] = useState(0);
  const [progress, setProgress] = useState(0);
  const lastSwitch = useRef(performance.now());
  useEffect(() => {
    if (paused) return;
    let raf: number;
    const tick = (now: number) => {
      const elapsed = now - lastSwitch.current;
      setProgress(Math.min(1, elapsed / interval));
      if (elapsed >= interval) {
        lastSwitch.current = now;
        setI((v) => (v + 1) % length);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [length, interval, paused]);
  const goTo = useCallback(
    (n: number) => {
      setI(n);
      lastSwitch.current = performance.now();
      setProgress(0);
    },
    []
  );
  return [i, goTo, progress];
}
