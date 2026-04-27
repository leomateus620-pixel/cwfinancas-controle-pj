import { useEffect, useMemo, useRef } from "react";

interface AIChipPulseProps {
  accent: string; // ex: "hsl(330 81% 60%)"
  active: boolean;
}

interface Pulse {
  veinIndex: number;
  progress: number; // 0..1 along the path
  velocity: number; // units/sec (in normalized progress)
  life: number; // 0..1 alpha multiplier
  born: number; // ms
}

/**
 * Anatomical heart-as-AI: a chip "beats" (~70bpm) and pumps light pulses
 * along organic SVG veins. All motion driven by requestAnimationFrame with
 * a simple physics model (spring-shaped systole, drag-decelerated pulses,
 * radial shockwave on each beat).
 */
export function AIChipPulse({ accent, active }: AIChipPulseProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const veinRefs = useRef<(SVGPathElement | null)[]>([]);
  const pulseRefs = useRef<(SVGGElement | null)[]>([]);
  const chipRef = useRef<SVGGElement | null>(null);
  const chipGlowRef = useRef<SVGCircleElement | null>(null);
  const shockRef = useRef<SVGCircleElement | null>(null);
  const particleRefs = useRef<(SVGCircleElement | null)[]>([]);

  const pulses = useRef<Pulse[]>([]);
  const lastBeat = useRef<number>(-1);
  const startTime = useRef<number>(performance.now());
  const rafId = useRef<number | null>(null);
  const veinLengths = useRef<number[]>([]);

  // Vein paths — organic Bézier curves radiating from the chip (center 60,60)
  // Stage is 240x120, chip sits at the left third.
  const veins = useMemo(
    () => [
      // upper-right main artery
      "M 78 56 C 110 40, 140 30, 170 28 S 215 36, 230 22",
      // upper-right capillary branch
      "M 78 56 C 105 50, 135 56, 158 70 S 195 78, 220 70",
      // right horizontal
      "M 80 60 C 120 60, 160 64, 200 58 S 232 60, 238 56",
      // lower-right main
      "M 78 64 C 110 78, 145 88, 178 92 S 215 96, 232 108",
      // lower-right capillary
      "M 78 64 C 100 72, 130 78, 150 90 S 185 105, 210 102",
      // upper soft loop
      "M 70 50 C 90 30, 120 18, 145 22 S 175 16, 195 8",
      // lower soft loop
      "M 70 70 C 88 92, 115 108, 140 110 S 175 116, 198 118",
      // short tendril back-left (visual balance)
      "M 60 50 C 50 35, 38 28, 24 22",
    ],
    [],
  );

  useEffect(() => {
    if (!active) {
      if (rafId.current) cancelAnimationFrame(rafId.current);
      return;
    }
    if (typeof window === "undefined") return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Measure path lengths once
    veinLengths.current = veinRefs.current.map((p) => (p ? p.getTotalLength() : 0));

    if (reduced) {
      // Static elegant snapshot for reduced motion
      if (chipGlowRef.current) chipGlowRef.current.setAttribute("opacity", "0.35");
      return;
    }

    const PERIOD = 850; // ms per heartbeat (~70bpm)
    startTime.current = performance.now();
    lastBeat.current = -1;

    const tick = (now: number) => {
      const elapsed = now - startTime.current;
      const beatIndex = Math.floor(elapsed / PERIOD);
      const phase = (elapsed % PERIOD) / PERIOD; // 0..1 within current beat

      // ── Heartbeat curve: sum of two gaussians (lub-dub)
      // First (sístole forte) at phase 0.05, second (sístole suave) at phase 0.22
      const g = (x: number, mu: number, sigma: number) =>
        Math.exp(-((x - mu) * (x - mu)) / (2 * sigma * sigma));
      const beat = g(phase, 0.05, 0.04) + 0.55 * g(phase, 0.22, 0.05);
      // Chip scale: 1.0 baseline → up to ~1.12 on systole
      const chipScale = 1 + beat * 0.12;
      // Chip glow intensity follows beat
      const glowOpacity = 0.18 + beat * 0.6;
      const glowR = 22 + beat * 12;

      if (chipRef.current) {
        chipRef.current.setAttribute(
          "transform",
          `translate(60 60) scale(${chipScale.toFixed(4)}) translate(-60 -60)`,
        );
      }
      if (chipGlowRef.current) {
        chipGlowRef.current.setAttribute("opacity", String(Math.min(1, glowOpacity)));
        chipGlowRef.current.setAttribute("r", String(glowR));
      }

      // ── New beat? Spawn pulses + shockwave
      if (beatIndex !== lastBeat.current) {
        lastBeat.current = beatIndex;
        // Spawn one pulse per vein with jittered velocity
        for (let i = 0; i < veins.length; i++) {
          pulses.current.push({
            veinIndex: i,
            progress: 0,
            velocity: 0.55 + Math.random() * 0.35, // progress/sec
            life: 1,
            born: now,
          });
        }
        // Shockwave reset
        if (shockRef.current) {
          shockRef.current.setAttribute("data-born", String(now));
        }
      }

      // ── Update shockwave (600ms expansion)
      if (shockRef.current) {
        const born = Number(shockRef.current.getAttribute("data-born") || "0");
        const dt = now - born;
        const t = Math.min(1, dt / 600);
        const ease = 1 - Math.pow(1 - t, 3);
        const r = 8 + ease * 52;
        const op = (1 - t) * 0.55;
        shockRef.current.setAttribute("r", String(r));
        shockRef.current.setAttribute("opacity", String(op));
      }

      // ── Update pulses (physics: drag deceleration + life decay near end)
      const dtSec = 1 / 60; // approximate; rAF is roughly 60fps
      const survivors: Pulse[] = [];
      for (const p of pulses.current) {
        // Slight drag — velocity decays 4%/sec
        p.velocity *= 1 - 0.04 * dtSec;
        p.progress += p.velocity * dtSec;
        // Fade out as it approaches the tip
        if (p.progress > 0.85) {
          p.life = Math.max(0, 1 - (p.progress - 0.85) / 0.18);
        }
        if (p.progress <= 1.05 && p.life > 0.02) {
          survivors.push(p);
        }
      }
      pulses.current = survivors;

      // Hide all pulse slots, then place active pulses into the first N slots
      const MAX_VISIBLE = pulseRefs.current.length;
      for (let i = 0; i < MAX_VISIBLE; i++) {
        const slot = pulseRefs.current[i];
        if (!slot) continue;
        const p = pulses.current[i];
        if (!p) {
          slot.setAttribute("opacity", "0");
          continue;
        }
        const path = veinRefs.current[p.veinIndex];
        const len = veinLengths.current[p.veinIndex] || 0;
        if (!path || len === 0) {
          slot.setAttribute("opacity", "0");
          continue;
        }
        const d = Math.min(p.progress, 1) * len;
        const pt = path.getPointAtLength(d);
        slot.setAttribute("transform", `translate(${pt.x.toFixed(2)} ${pt.y.toFixed(2)})`);
        slot.setAttribute("opacity", String(p.life.toFixed(3)));
      }

      // ── Atmospheric particles (slow drift)
      const tSec = elapsed / 1000;
      for (let i = 0; i < particleRefs.current.length; i++) {
        const c = particleRefs.current[i];
        if (!c) continue;
        const seed = i * 1.7;
        const cx = 100 + i * 32 + Math.sin(tSec * 0.6 + seed) * 8;
        const cy = 30 + ((i * 23) % 70) + Math.cos(tSec * 0.5 + seed) * 6;
        const op = 0.25 + 0.25 * Math.sin(tSec * 1.3 + seed);
        c.setAttribute("cx", String(cx));
        c.setAttribute("cy", String(cy));
        c.setAttribute("opacity", String(op));
      }

      rafId.current = requestAnimationFrame(tick);
    };

    rafId.current = requestAnimationFrame(tick);

    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [active, veins]);

  const gradId = useMemo(() => `aichip-grad-${Math.random().toString(36).slice(2, 9)}`, []);
  const veinGradId = `${gradId}-vein`;
  const chipGradId = `${gradId}-chip`;

  return (
    <div className="relative w-full h-full pointer-events-none select-none">
      <svg
        ref={svgRef}
        viewBox="0 0 240 120"
        className="absolute inset-0 w-full h-full overflow-visible"
        aria-hidden="true"
      >
        <defs>
          {/* Vein gradient: bright at chip, fading at tips */}
          <linearGradient id={veinGradId} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor={accent} stopOpacity="0.85" />
            <stop offset="60%" stopColor={accent} stopOpacity="0.35" />
            <stop offset="100%" stopColor={accent} stopOpacity="0.05" />
          </linearGradient>

          {/* Chip body gradient */}
          <linearGradient id={chipGradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="1" />
            <stop offset="100%" stopColor={accent} stopOpacity="0.55" />
          </linearGradient>

          {/* Soft blur for veins (organic feel) */}
          <filter id={`${gradId}-soft`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="0.4" />
          </filter>

          {/* Glow for pulses */}
          <filter id={`${gradId}-glow`} x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="2.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Atmospheric particles (drift) */}
        {Array.from({ length: 6 }).map((_, i) => (
          <circle
            key={`p-${i}`}
            ref={(el) => (particleRefs.current[i] = el)}
            r={i % 2 === 0 ? 1.1 : 0.7}
            fill={accent}
            opacity="0.25"
          />
        ))}

        {/* Chip ambient glow (under everything) */}
        <circle
          ref={chipGlowRef}
          cx="60"
          cy="60"
          r="22"
          fill={accent}
          opacity="0.25"
          filter={`url(#${gradId}-glow)`}
        />

        {/* Veins */}
        <g filter={`url(#${gradId}-soft)`}>
          {veins.map((d, i) => (
            <path
              key={`v-${i}`}
              ref={(el) => (veinRefs.current[i] = el)}
              d={d}
              fill="none"
              stroke={`url(#${veinGradId})`}
              strokeWidth={i < 5 ? 1.4 : 0.9}
              strokeLinecap="round"
              opacity={i < 5 ? 0.85 : 0.55}
            />
          ))}
        </g>

        {/* Shockwave ring (on each beat) */}
        <circle
          ref={shockRef}
          cx="60"
          cy="60"
          r="8"
          fill="none"
          stroke={accent}
          strokeWidth="1"
          opacity="0"
        />

        {/* Chip — heart of the system */}
        <g ref={chipRef}>
          {/* pins (top, bottom, left, right) */}
          {[
            { x: 50, y: 41, w: 3, h: 4 },
            { x: 57, y: 41, w: 3, h: 4 },
            { x: 64, y: 41, w: 3, h: 4 },
            { x: 50, y: 75, w: 3, h: 4 },
            { x: 57, y: 75, w: 3, h: 4 },
            { x: 64, y: 75, w: 3, h: 4 },
            { x: 41, y: 50, w: 4, h: 3 },
            { x: 41, y: 57, w: 4, h: 3 },
            { x: 41, y: 64, w: 4, h: 3 },
            { x: 75, y: 50, w: 4, h: 3 },
            { x: 75, y: 57, w: 4, h: 3 },
            { x: 75, y: 64, w: 4, h: 3 },
          ].map((pin, i) => (
            <rect
              key={`pin-${i}`}
              x={pin.x}
              y={pin.y}
              width={pin.w}
              height={pin.h}
              rx="0.6"
              fill={accent}
              opacity="0.75"
            />
          ))}
          {/* chip body */}
          <rect
            x="45"
            y="45"
            width="30"
            height="30"
            rx="5"
            fill={`url(#${chipGradId})`}
            stroke={accent}
            strokeWidth="0.8"
            strokeOpacity="0.9"
          />
          {/* inner panel for depth */}
          <rect
            x="48"
            y="48"
            width="24"
            height="24"
            rx="3.5"
            fill="hsl(0 0% 0% / 0.18)"
            stroke="hsl(0 0% 100% / 0.15)"
            strokeWidth="0.5"
          />
          {/* AI mark — stylized sparkle */}
          <g transform="translate(60 60)">
            <path
              d="M 0 -7 L 1.6 -1.6 L 7 0 L 1.6 1.6 L 0 7 L -1.6 1.6 L -7 0 L -1.6 -1.6 Z"
              fill="hsl(0 0% 100% / 0.95)"
            />
            <circle cx="0" cy="0" r="1.2" fill={accent} />
          </g>
        </g>

        {/* Pulses (light blobs traveling along veins) */}
        {Array.from({ length: 24 }).map((_, i) => (
          <g
            key={`pulse-${i}`}
            ref={(el) => (pulseRefs.current[i] = el)}
            opacity="0"
            filter={`url(#${gradId}-glow)`}
          >
            {/* trail */}
            <circle r="1" fill="hsl(0 0% 100%)" opacity="0.35" />
            <circle r="1.6" fill={accent} opacity="0.55" />
            {/* head */}
            <circle r="2.4" fill="hsl(0 0% 100%)" />
          </g>
        ))}
      </svg>
    </div>
  );
}
