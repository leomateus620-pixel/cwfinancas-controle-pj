import { AbsoluteFill, useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";
import { GlassCard } from "../components/GlassCard";

const kpis = [
  { label: "Receitas", value: 84200, prefix: "R$ ", color: "#059669" },
  { label: "Despesas", value: 52800, prefix: "R$ ", color: "#DC2626" },
  { label: "Lucro", value: 31400, prefix: "R$ ", color: "#3B82F6" },
];

function formatCurrency(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 0 });
}

// SVG chart path
const chartPoints = [
  [0, 70], [1, 55], [2, 62], [3, 45], [4, 52], [5, 38],
  [6, 42], [7, 30], [8, 35], [9, 22], [10, 28], [11, 15],
];

function buildPath(points: number[][], progress: number): string {
  const visibleCount = Math.max(2, Math.ceil(points.length * progress));
  const visible = points.slice(0, visibleCount);
  return visible.map((p, i) => {
    const x = (p[0] / 11) * 700 + 40;
    const y = p[1] * 2.2 + 20;
    return i === 0 ? `M${x},${y}` : `L${x},${y}`;
  }).join(" ");
}

export const KPIShowcase: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Chart progress
  const chartProgress = interpolate(frame, [20, 70], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Exit
  const exitOpacity = interpolate(frame, [75, 90], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: 60,
        opacity: exitOpacity,
      }}
    >
      {/* KPI Cards Row */}
      <div
        style={{
          display: "flex",
          gap: 24,
          width: "100%",
          maxWidth: 900,
          position: "absolute",
          top: 140,
          left: "50%",
          transform: "translateX(-50%)",
        }}
      >
        {kpis.map((kpi, i) => {
          const delay = 5 + i * 10;
          const s = spring({ frame: frame - delay, fps, config: { damping: 18, stiffness: 200 } });
          const scale = interpolate(s, [0, 1], [0.8, 1]);
          const opacity = interpolate(frame, [delay, delay + 10], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          // Animated value counter
          const countProgress = interpolate(frame, [delay + 5, delay + 40], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const displayValue = Math.round(kpi.value * countProgress);

          return (
            <GlassCard
              key={kpi.label}
              highlight={i === 2}
              style={{
                flex: 1,
                padding: "28px 24px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                transform: `scale(${scale})`,
                opacity,
              }}
            >
              <span
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.5)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                {kpi.label}
              </span>
              <span
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: 32,
                  fontWeight: 700,
                  color: kpi.color,
                  letterSpacing: "-0.02em",
                }}
              >
                {kpi.prefix}{formatCurrency(displayValue)}
              </span>
            </GlassCard>
          );
        })}
      </div>

      {/* Chart area */}
      <GlassCard
        style={{
          position: "absolute",
          bottom: 120,
          left: "50%",
          transform: "translateX(-50%)",
          width: 800,
          height: 220,
          padding: "20px 0",
          opacity: interpolate(frame, [15, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 16,
            left: 24,
            fontFamily: "Inter, sans-serif",
            fontSize: 13,
            fontWeight: 500,
            color: "rgba(255,255,255,0.4)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Evolução Mensal
        </div>
        <svg width={780} height={190} viewBox="0 0 780 190" style={{ marginLeft: 10, marginTop: 10 }}>
          {/* Grid lines */}
          {[40, 80, 120, 160].map((y) => (
            <line key={y} x1={40} y1={y} x2={740} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
          ))}
          {/* Gradient fill */}
          <defs>
            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(59,130,246,0.2)" />
              <stop offset="100%" stopColor="rgba(59,130,246,0)" />
            </linearGradient>
          </defs>
          {chartProgress > 0.1 && (
            <path
              d={buildPath(chartPoints, chartProgress) + ` L${(Math.min(11, Math.ceil(chartPoints.length * chartProgress) - 1) / 11) * 700 + 40},185 L40,185 Z`}
              fill="url(#chartGrad)"
            />
          )}
          {/* Line */}
          <path
            d={buildPath(chartPoints, chartProgress)}
            fill="none"
            stroke="#3B82F6"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: "drop-shadow(0 0 6px rgba(59,130,246,0.4))" }}
          />
        </svg>
      </GlassCard>
    </AbsoluteFill>
  );
};
