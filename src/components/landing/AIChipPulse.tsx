import { useEffect, useMemo, useRef } from "react";

interface AIChipPulseProps {
  accent: string;
  active: boolean;
}

interface Pulse {
  veinIndex: number;
  progress: number;
  velocity: number;
  life: number;
  born: number;
}

/**
 * Premium AI Chip — anatomical heart-as-AI.
 * A large, dimensional chip beats (~68bpm) and pumps light pulses
 * along organic SVG veins. Driven by requestAnimationFrame with
 * a simple physics model (gaussian-shaped systole, drag-decelerated
 * pulses, expanding shockwaves per beat, orbital ring, drifting particles).
 */
export function AIChipPulse({ accent, active }: AIChipPulseProps) {
  const veinRefs = useRef<(SVGPathElement | null)[]>([]);
  const pulseRefs = useRef<(SVGGElement | null)[]>([]);
  const chipScaleRef = useRef<SVGGElement | null>(null);
  const chipGlowRef = useRef<SVGCircleElement | null>(null);
  const chipHaloRef = useRef<SVGCircleElement | null>(null);
  const shockRef = useRef<SVGCircleElement | null>(null);
  const shock2Ref = useRef<SVGCircleElement | null>(null);
  const orbitRef = useRef<SVGGElement | null>(null);
  const ecgRef = useRef<SVGPathElement | null>(null);
  const particleRefs = useRef<(SVGCircleElement | null)[]>([]);
  const aiTextRef = useRef<SVGTextElement | null>(null);

  const pulses = useRef<Pulse[]>([]);
  const lastBeat = useRef<number>(-1);
  const startTime = useRef<number>(0);
  const rafId = useRef<number | null>(null);
  const veinLengths = useRef<number[]>([]);

  // ViewBox 280 x 200, chip centered at (90, 100).
  // Veins radiate to the right + envelop the chip with two soft loops + left tendrils.
  const veins = useMemo(
    () => [
      "M 122 82 C 158 60, 196 50, 230 44 S 268 42, 276 30",
      "M 122 88 C 152 80, 184 84, 210 96 S 246 102, 268 92",
      "M 124 100 C 162 100, 200 104, 238 96 S 270 96, 278 92",
      "M 124 106 C 158 116, 196 118, 226 110 S 258 108, 274 116",
      "M 122 118 C 158 138, 198 152, 232 156 S 268 162, 276 174",
      "M 122 114 C 148 124, 178 132, 200 146 S 232 162, 254 162",
      "M 110 76 C 130 50, 168 30, 200 32 S 240 26, 262 14",
      "M 110 124 C 128 158, 162 180, 198 184 S 238 190, 264 188",
      "M 76 90 C 56 76, 40 68, 16 64",
      "M 76 110 C 52 122, 36 132, 12 138",
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
    veinLengths.current = veinRefs.current.map((p) => (p ? p.getTotalLength() : 0));

    if (reduced) {
      if (chipGlowRef.current) chipGlowRef.current.setAttribute("opacity", "0.45");
      if (chipHaloRef.current) chipHaloRef.current.setAttribute("opacity", "0.25");
      return;
    }

    const PERIOD = 880; // ms (~68bpm)
    startTime.current = performance.now();
    lastBeat.current = -1;
    let prevT = performance.now();

    const tick = (now: number) => {
      const dtSec = Math.min(0.05, (now - prevT) / 1000);
      prevT = now;
      const elapsed = now - startTime.current;
      const beatIndex = Math.floor(elapsed / PERIOD);
      const phase = (elapsed % PERIOD) / PERIOD;

      const g = (x: number, mu: number, sigma: number) =>
        Math.exp(-((x - mu) * (x - mu)) / (2 * sigma * sigma));
      const beat = g(phase, 0.05, 0.04) + 0.6 * g(phase, 0.22, 0.05);

      // Chip subtle scale pulse anchored at center (90, 100)
      const chipScale = 1 + beat * 0.09;
      if (chipScaleRef.current) {
        chipScaleRef.current.setAttribute(
          "transform",
          `translate(90 100) scale(${chipScale.toFixed(4)}) translate(-90 -100)`,
        );
      }

      if (chipGlowRef.current) {
        chipGlowRef.current.setAttribute(
          "opacity",
          String(Math.min(1, 0.28 + beat * 0.55)),
        );
        chipGlowRef.current.setAttribute("r", String(38 + beat * 14));
      }
      if (chipHaloRef.current) {
        chipHaloRef.current.setAttribute(
          "opacity",
          String(Math.min(0.5, 0.12 + beat * 0.28)),
        );
        chipHaloRef.current.setAttribute("r", String(72 + beat * 22));
      }
      if (aiTextRef.current) {
        aiTextRef.current.setAttribute(
          "opacity",
          String(0.85 + Math.min(0.15, beat * 0.5)),
        );
      }

      // New beat? spawn pulses + restart shockwaves
      if (beatIndex !== lastBeat.current) {
        lastBeat.current = beatIndex;
        for (let i = 0; i < veins.length; i++) {
          const count = i < 6 ? 2 : 1;
          for (let k = 0; k < count; k++) {
            pulses.current.push({
              veinIndex: i,
              progress: -k * 0.05,
              velocity: 0.5 + Math.random() * 0.45,
              life: 1,
              born: now,
            });
          }
        }
        if (shockRef.current) shockRef.current.setAttribute("data-born", String(now));
        if (shock2Ref.current)
          shock2Ref.current.setAttribute("data-born", String(now + 110));
      }

      const updateShock = (
        ref: SVGCircleElement | null,
        baseR: number,
        maxR: number,
        dur: number,
        peakOp: number,
      ) => {
        if (!ref) return;
        const born = Number(ref.getAttribute("data-born") || "0");
        const dt = now - born;
        if (dt < 0) {
          ref.setAttribute("opacity", "0");
          return;
        }
        const t = Math.min(1, dt / dur);
        const ease = 1 - Math.pow(1 - t, 3);
        ref.setAttribute("r", String(baseR + ease * (maxR - baseR)));
        ref.setAttribute("opacity", String((1 - t) * peakOp));
      };
      updateShock(shockRef.current, 14, 95, 700, 0.55);
      updateShock(shock2Ref.current, 14, 70, 600, 0.35);

      if (orbitRef.current) {
        const angle = (elapsed * 0.018) % 360;
        orbitRef.current.setAttribute(
          "transform",
          `translate(90 100) rotate(${angle.toFixed(2)})`,
        );
      }

      if (ecgRef.current) {
        const off = -((elapsed * 0.04) % 200);
        ecgRef.current.setAttribute("stroke-dashoffset", String(off));
        ecgRef.current.setAttribute("opacity", String(0.25 + beat * 0.4));
      }

      // Pulses physics
      const survivors: Pulse[] = [];
      for (const p of pulses.current) {
        p.velocity *= 1 - 0.05 * dtSec;
        p.progress += p.velocity * dtSec;
        if (p.progress > 0.85) {
          p.life = Math.max(0, 1 - (p.progress - 0.85) / 0.18);
        }
        if (p.progress <= 1.05 && p.life > 0.02) survivors.push(p);
      }
      survivors.sort((a, b) => b.born - a.born);
      pulses.current = survivors;

      const MAX = pulseRefs.current.length;
      for (let i = 0; i < MAX; i++) {
        const slot = pulseRefs.current[i];
        if (!slot) continue;
        const p = pulses.current[i];
        if (!p || p.progress < 0) {
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

      const tSec = elapsed / 1000;
      for (let i = 0; i < particleRefs.current.length; i++) {
        const c = particleRefs.current[i];
        if (!c) continue;
        const seed = i * 1.7;
        const cx = 30 + ((i * 41) % 230) + Math.sin(tSec * 0.6 + seed) * 9;
        const cy = 20 + ((i * 29) % 160) + Math.cos(tSec * 0.5 + seed) * 7;
        const op = 0.18 + 0.2 * Math.sin(tSec * 1.3 + seed);
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

  const id = useMemo(() => `aichip-${Math.random().toString(36).slice(2, 9)}`, []);
  const veinGradId = `${id}-vein`;
  const chipGradId = `${id}-chip`;
  const chipBevelId = `${id}-bevel`;
  const innerGradId = `${id}-inner`;
  const haloId = `${id}-halo`;
  const softId = `${id}-soft`;
  const glowId = `${id}-glow`;
  const strongGlowId = `${id}-sglow`;

  const pins = [
    ...[0, 1, 2, 3].map((k) => ({ x: 70 + k * 12, y: 60, w: 5, h: 8, orient: "v" as const })),
    ...[0, 1, 2, 3].map((k) => ({ x: 70 + k * 12, y: 132, w: 5, h: 8, orient: "v" as const })),
    ...[0, 1, 2, 3].map((k) => ({ x: 52, y: 80 + k * 12, w: 8, h: 5, orient: "h" as const })),
    ...[0, 1, 2, 3].map((k) => ({ x: 120, y: 80 + k * 12, w: 8, h: 5, orient: "h" as const })),
  ];

  return (
    <div className="relative w-full h-full pointer-events-none select-none">
      <svg
        viewBox="0 0 280 200"
        className="absolute inset-0 w-full h-full overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={veinGradId} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor={accent} stopOpacity="1" />
            <stop offset="55%" stopColor={accent} stopOpacity="0.45" />
            <stop offset="100%" stopColor={accent} stopOpacity="0.05" />
          </linearGradient>

          <linearGradient id={chipGradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="1" />
            <stop offset="50%" stopColor={accent} stopOpacity="0.85" />
            <stop offset="100%" stopColor={accent} stopOpacity="0.5" />
          </linearGradient>

          <linearGradient id={chipBevelId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(0 0% 100% / 0.55)" />
            <stop offset="55%" stopColor="hsl(0 0% 100% / 0.05)" />
            <stop offset="100%" stopColor="hsl(0 0% 0% / 0.35)" />
          </linearGradient>

          <radialGradient id={innerGradId} cx="0.35" cy="0.3" r="0.8">
            <stop offset="0%" stopColor="hsl(0 0% 100% / 0.45)" />
            <stop offset="60%" stopColor="hsl(0 0% 100% / 0)" />
          </radialGradient>

          <radialGradient id={haloId} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor={accent} stopOpacity="0.55" />
            <stop offset="60%" stopColor={accent} stopOpacity="0.12" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </radialGradient>

          <filter id={softId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="0.5" />
          </filter>

          <filter id={glowId} x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="2.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id={strongGlowId} x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Atmospheric drifting particles */}
        {Array.from({ length: 10 }).map((_, i) => (
          <circle
            key={`p-${i}`}
            ref={(el) => (particleRefs.current[i] = el)}
            r={i % 3 === 0 ? 1.4 : i % 3 === 1 ? 0.9 : 0.6}
            fill={accent}
            opacity="0.2"
          />
        ))}

        {/* Outer atmospheric halo */}
        <circle
          ref={chipHaloRef}
          cx="90"
          cy="100"
          r="72"
          fill={`url(#${haloId})`}
          opacity="0.18"
          filter={`url(#${strongGlowId})`}
        />

        {/* Inner glow close to chip */}
        <circle
          ref={chipGlowRef}
          cx="90"
          cy="100"
          r="38"
          fill={accent}
          opacity="0.32"
          filter={`url(#${glowId})`}
        />

        {/* Veins */}
        <g filter={`url(#${softId})`}>
          {veins.map((d, i) => (
            <path
              key={`v-${i}`}
              ref={(el) => (veinRefs.current[i] = el)}
              d={d}
              fill="none"
              stroke={`url(#${veinGradId})`}
              strokeWidth={i < 6 ? 1.8 : 1.2}
              strokeLinecap="round"
              opacity={i < 6 ? 0.92 : 0.6}
            />
          ))}
        </g>

        {/* Shockwaves */}
        <circle
          ref={shockRef}
          cx="90"
          cy="100"
          r="14"
          fill="none"
          stroke={accent}
          strokeWidth="1.4"
          opacity="0"
        />
        <circle
          ref={shock2Ref}
          cx="90"
          cy="100"
          r="14"
          fill="none"
          stroke="hsl(0 0% 100%)"
          strokeWidth="0.9"
          opacity="0"
        />

        {/* Orbital ring */}
        <g ref={orbitRef} transform="translate(90 100)">
          <circle
            cx="0"
            cy="0"
            r="50"
            fill="none"
            stroke={accent}
            strokeOpacity="0.22"
            strokeWidth="0.6"
            strokeDasharray="2 5"
          />
          <circle cx="50" cy="0" r="1.8" fill={accent} opacity="0.85" />
          <circle cx="-50" cy="0" r="1.2" fill="hsl(0 0% 100%)" opacity="0.6" />
          <circle cx="0" cy="50" r="1" fill={accent} opacity="0.7" />
        </g>

        {/* ECG mini line */}
        <path
          ref={ecgRef}
          d="M -10 168 L 20 168 L 28 158 L 36 178 L 44 148 L 52 168 L 90 168 L 98 158 L 106 178 L 114 148 L 122 168 L 200 168"
          fill="none"
          stroke={accent}
          strokeWidth="0.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="200 200"
          strokeDashoffset="0"
          opacity="0.35"
        />

        {/* Chip — premium 3D */}
        <g ref={chipScaleRef}>
          <rect
            x="60"
            y="71"
            width="60"
            height="60"
            rx="10"
            fill="hsl(0 0% 0% / 0.35)"
            filter={`url(#${glowId})`}
            opacity="0.7"
          />

          {pins.map((pin, i) => (
            <g key={`pin-${i}`}>
              <rect
                x={pin.x}
                y={pin.y}
                width={pin.w}
                height={pin.h}
                rx="1"
                fill={accent}
                opacity="0.9"
              />
              <rect
                x={pin.x + 0.5}
                y={pin.y + 0.5}
                width={pin.orient === "v" ? pin.w - 1 : pin.w * 0.4}
                height={pin.orient === "v" ? pin.h * 0.4 : pin.h - 1}
                rx="0.6"
                fill="hsl(0 0% 100% / 0.4)"
              />
            </g>
          ))}

          <rect
            x="60"
            y="70"
            width="60"
            height="60"
            rx="11"
            fill={`url(#${chipGradId})`}
            stroke={accent}
            strokeWidth="0.9"
          />
          <rect
            x="60"
            y="70"
            width="60"
            height="60"
            rx="11"
            fill={`url(#${chipBevelId})`}
            opacity="0.6"
          />
          <rect
            x="66"
            y="76"
            width="48"
            height="48"
            rx="7"
            fill="hsl(0 0% 0% / 0.35)"
            stroke="hsl(0 0% 100% / 0.18)"
            strokeWidth="0.7"
          />
          <rect
            x="66"
            y="76"
            width="48"
            height="48"
            rx="7"
            fill={`url(#${innerGradId})`}
          />

          <g
            stroke="hsl(0 0% 100% / 0.35)"
            strokeWidth="0.5"
            fill="none"
            strokeLinecap="round"
          >
            <path d="M 70 86 L 76 86 L 78 88" />
            <path d="M 70 114 L 76 114 L 78 112" />
            <path d="M 110 86 L 104 86 L 102 88" />
            <path d="M 110 114 L 104 114 L 102 112" />
            <circle cx="70" cy="86" r="0.9" fill={accent} opacity="0.9" />
            <circle cx="70" cy="114" r="0.9" fill={accent} opacity="0.9" />
            <circle cx="110" cy="86" r="0.9" fill={accent} opacity="0.9" />
            <circle cx="110" cy="114" r="0.9" fill={accent} opacity="0.9" />
          </g>

          <g transform="translate(90 100)" opacity="0.8">
            <path
              d="M 0 -16 L 2.5 -2.5 L 16 0 L 2.5 2.5 L 0 16 L -2.5 2.5 L -16 0 L -2.5 -2.5 Z"
              fill={accent}
              opacity="0.55"
            />
          </g>

          <text
            ref={aiTextRef}
            x="90"
            y="100"
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
            fontWeight="900"
            fontSize="18"
            letterSpacing="0.06em"
            fill="hsl(0 0% 100%)"
            opacity="0.95"
            style={{ filter: `drop-shadow(0 0 8px ${accent})` }}
          >
            AI
          </text>

          <circle cx="68" cy="78" r="1.6" fill="hsl(0 0% 100% / 0.5)" />
        </g>

        {/* Pulses */}
        {Array.from({ length: 32 }).map((_, i) => (
          <g
            key={`pulse-${i}`}
            ref={(el) => (pulseRefs.current[i] = el)}
            opacity="0"
            filter={`url(#${glowId})`}
          >
            <circle r="1.4" fill="hsl(0 0% 100%)" opacity="0.4" />
            <circle r="2.4" fill={accent} opacity="0.7" />
            <circle r="3.2" fill="hsl(0 0% 100%)" />
          </g>
        ))}
      </svg>
    </div>
  );
}
