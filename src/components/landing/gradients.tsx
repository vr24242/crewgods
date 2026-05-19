"use client";

import React from "react";

type GradientStop = {
  cx: number;
  cy: number;
  r?: number;
  rx?: number;
  ry?: number;
  color: string;
  opacity?: number;
};

const NoiseFilter = ({ id, freq = 0.9, oct = 2, opacity = 0.45 }: { id: string; freq?: number; oct?: number; opacity?: number }) => (
  <filter id={id} x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency={freq} numOctaves={oct} stitchTiles="stitch" />
    <feColorMatrix values={`0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 ${opacity} 0`} />
    <feComposite in2="SourceGraphic" operator="in" />
  </filter>
);

function GradientArt({
  width = 1200,
  height = 600,
  stops,
  base = "#1B3A52",
  grain = 0.6,
  className = "",
}: {
  width?: number;
  height?: number;
  stops: GradientStop[];
  base?: string;
  grain?: number;
  className?: string;
}) {
  const fid = React.useId().replace(/:/g, "");
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid slice"
      className={className}
      role="img"
      aria-hidden="true"
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      <defs>
        {stops.map((s, i) => (
          <radialGradient key={i} id={`g${fid}-${i}`} cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
            <stop offset="0%" stopColor={s.color} stopOpacity={s.opacity ?? 1} />
            <stop offset="60%" stopColor={s.color} stopOpacity={(s.opacity ?? 1) * 0.35} />
            <stop offset="100%" stopColor={s.color} stopOpacity="0" />
          </radialGradient>
        ))}
        <NoiseFilter id={`n${fid}`} freq={1.2} oct={2} opacity={grain} />
      </defs>
      <rect width={width} height={height} fill={base} />
      {stops.map((s, i) => (
        <ellipse key={i} cx={s.cx} cy={s.cy} rx={s.rx ?? s.r} ry={s.ry ?? s.r} fill={`url(#g${fid}-${i})`} />
      ))}
      <rect width={width} height={height} filter={`url(#n${fid})`} opacity="0.85" />
    </svg>
  );
}

export function HeroGradient({ className = "" }: { className?: string }) {
  return (
    <div className={`relative img-blob ${className}`} style={{ aspectRatio: "2.4 / 1" }}>
      <GradientArt
        width={1400}
        height={580}
        base="#E8D8C4"
        grain={0.7}
        stops={[
          { cx: 280, cy: 320, r: 360, color: "#F4A156", opacity: 0.95 },
          { cx: 540, cy: 260, r: 280, color: "#FFC98A", opacity: 0.85 },
          { cx: 780, cy: 250, r: 260, color: "#F26B7A", opacity: 0.85 },
          { cx: 920, cy: 280, r: 240, color: "#FF8A47", opacity: 0.75 },
          { cx: 1140, cy: 300, r: 380, color: "#6FA0C8", opacity: 0.85 },
          { cx: 1280, cy: 360, r: 260, color: "#4F7AA6", opacity: 0.7 },
        ]}
      />
      <svg
        viewBox="0 0 1400 580"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 w-full h-full pointer-events-none"
        aria-hidden="true"
      >
        <defs>
          <pattern id="heroDots" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="20" cy="20" r="4.5" fill="#FFFFFF" opacity="0.92" />
          </pattern>
        </defs>
        <rect width="1400" height="580" fill="url(#heroDots)" />
      </svg>
    </div>
  );
}

export function StatsGradient({ className = "" }: { className?: string }) {
  return (
    <div className={`img-blob ${className}`} style={{ aspectRatio: "2.6 / 1" }}>
      <GradientArt
        width={1400}
        height={540}
        base="#3D6B6A"
        grain={0.75}
        stops={[
          { cx: 320, cy: 300, r: 360, color: "#5FA39B", opacity: 0.9 },
          { cx: 700, cy: 180, r: 280, color: "#FF7A35", opacity: 0.95 },
          { cx: 760, cy: 240, r: 180, color: "#FFB16A", opacity: 0.85 },
          { cx: 1100, cy: 360, r: 380, color: "#2F5C5B", opacity: 0.9 },
          { cx: 1280, cy: 200, r: 220, color: "#7AB5AA", opacity: 0.7 },
        ]}
      />
    </div>
  );
}

const stepPalettes: Record<string, { base: string; stops: GradientStop[] }> = {
  purple: {
    base: "#5A4A8A",
    stops: [
      { cx: 540, cy: 380, r: 380, color: "#6E5BB8", opacity: 0.95 },
      { cx: 700, cy: 280, r: 240, color: "#E68AA5", opacity: 0.9 },
      { cx: 770, cy: 350, r: 180, color: "#FF9A6A", opacity: 0.95 },
      { cx: 840, cy: 220, r: 200, color: "#FFC6B0", opacity: 0.8 },
    ],
  },
  teal: {
    base: "#2C4F4D",
    stops: [
      { cx: 540, cy: 340, r: 380, color: "#3F7470", opacity: 0.9 },
      { cx: 720, cy: 280, r: 240, color: "#FF7A35", opacity: 0.85 },
      { cx: 770, cy: 360, r: 180, color: "#FFB16A", opacity: 0.85 },
    ],
  },
  rose: {
    base: "#7E4554",
    stops: [
      { cx: 540, cy: 340, r: 380, color: "#C26B7F", opacity: 0.9 },
      { cx: 760, cy: 260, r: 240, color: "#FFC98A", opacity: 0.85 },
      { cx: 820, cy: 360, r: 180, color: "#F26B7A", opacity: 0.95 },
    ],
  },
  blue: {
    base: "#3B5A8A",
    stops: [
      { cx: 540, cy: 340, r: 380, color: "#5277B0", opacity: 0.9 },
      { cx: 760, cy: 260, r: 240, color: "#9CC2E2", opacity: 0.7 },
      { cx: 820, cy: 360, r: 180, color: "#FFC98A", opacity: 0.7 },
    ],
  },
};

export function StepGradient({ tone = "purple", className = "" }: { tone?: string; className?: string }) {
  const p = stepPalettes[tone] || stepPalettes.purple;
  return (
    <div className={`img-blob ${className}`} style={{ aspectRatio: "4 / 3" }}>
      <GradientArt width={1400} height={1050} base={p.base} grain={0.8} stops={p.stops} />
    </div>
  );
}

const thumbPalettes: Record<string, { base: string; stops: GradientStop[] }> = {
  orange: { base: "#E8AA6A", stops: [{ cx: 200, cy: 200, r: 160, color: "#FF8A47", opacity: 1 }, { cx: 260, cy: 180, r: 120, color: "#F26B7A", opacity: 0.85 }] },
  teal: { base: "#5FA39B", stops: [{ cx: 200, cy: 200, r: 160, color: "#3D6B6A", opacity: 1 }, { cx: 240, cy: 180, r: 120, color: "#FF7A35", opacity: 0.7 }] },
  purple: { base: "#7A6BB8", stops: [{ cx: 200, cy: 200, r: 160, color: "#E68AA5", opacity: 0.9 }, { cx: 240, cy: 220, r: 120, color: "#FFC98A", opacity: 0.7 }] },
  blue: { base: "#6FA0C8", stops: [{ cx: 200, cy: 200, r: 160, color: "#4F7AA6", opacity: 1 }, { cx: 240, cy: 220, r: 120, color: "#FFC98A", opacity: 0.55 }] },
  rose: { base: "#C26B7F", stops: [{ cx: 200, cy: 200, r: 160, color: "#F26B7A", opacity: 1 }, { cx: 240, cy: 220, r: 120, color: "#FFC98A", opacity: 0.55 }] },
  sage: { base: "#9AAE85", stops: [{ cx: 200, cy: 200, r: 160, color: "#6B8665", opacity: 1 }, { cx: 240, cy: 220, r: 120, color: "#FFC98A", opacity: 0.55 }] },
  sand: { base: "#D8B98A", stops: [{ cx: 200, cy: 200, r: 160, color: "#A87E50", opacity: 1 }, { cx: 240, cy: 220, r: 120, color: "#FF7A35", opacity: 0.55 }] },
  indigo: { base: "#4F5494", stops: [{ cx: 200, cy: 200, r: 160, color: "#3D3F70", opacity: 1 }, { cx: 240, cy: 220, r: 120, color: "#9CC2E2", opacity: 0.7 }] },
};

export function BlobThumb({ tone = "orange", size = 64 }: { tone?: string; size?: number }) {
  const p = thumbPalettes[tone] || thumbPalettes.orange;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden" }}>
      <GradientArt width={400} height={400} base={p.base} grain={0.8} stops={p.stops} />
    </div>
  );
}

export function FooterGradient({ className = "" }: { className?: string }) {
  return (
    <div className={`img-blob ${className}`} style={{ aspectRatio: "5 / 1" }}>
      <GradientArt
        width={1600}
        height={320}
        base="#2C4F4D"
        grain={0.75}
        stops={[
          { cx: 280, cy: 160, r: 280, color: "#FF7A35", opacity: 0.95 },
          { cx: 540, cy: 140, r: 260, color: "#F26B7A", opacity: 0.85 },
          { cx: 820, cy: 180, r: 320, color: "#5A4A8A", opacity: 0.9 },
          { cx: 1180, cy: 160, r: 320, color: "#6FA0C8", opacity: 0.85 },
          { cx: 1480, cy: 200, r: 260, color: "#3D6B6A", opacity: 0.95 },
        ]}
      />
    </div>
  );
}
