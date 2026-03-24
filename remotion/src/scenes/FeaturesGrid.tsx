import { AbsoluteFill, useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";
import { GlassCard } from "../components/GlassCard";

const features = [
  { label: "Receitas", color: "#059669", icon: "M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" },
  { label: "Despesas", color: "#DC2626", icon: "M21 4H3M21 4l-3 16H6L3 4M9 10h6" },
  { label: "Fluxo de Caixa", color: "#3B82F6", icon: "M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01" },
  { label: "DRE", color: "#8B5CF6", icon: "M9 17H7A5 5 0 017 7h2m6 10h2a5 5 0 005-5 5 5 0 00-5-5h-2" },
  { label: "Contas", color: "#F59E0B", icon: "M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" },
  { label: "Previsões IA", color: "#14B8A6", icon: "M22 12h-4l-3 9L9 3l-3 9H2" },
];

export const FeaturesGrid: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Title
  const titleSpring = spring({ frame, fps, config: { damping: 20, stiffness: 200 } });
  const titleY = interpolate(titleSpring, [0, 1], [40, 0]);

  // Exit
  const exitOpacity = interpolate(frame, [90, 105], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: 80,
        opacity: exitOpacity,
      }}
    >
      {/* Section title */}
      <div
        style={{
          position: "absolute",
          top: 120,
          fontFamily: "Inter, sans-serif",
          fontSize: 28,
          fontWeight: 600,
          color: "rgba(255,255,255,0.7)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          transform: `translateY(${titleY}px)`,
          opacity: titleSpring,
        }}
      >
        Tudo em um só lugar
      </div>

      {/* Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 24,
          width: "100%",
          maxWidth: 820,
          marginTop: 40,
        }}
      >
        {features.map((f, i) => {
          const delay = 12 + i * 8;
          const s = spring({ frame: frame - delay, fps, config: { damping: 18, stiffness: 180 } });
          const y = interpolate(s, [0, 1], [50, 0]);
          const cardOpacity = interpolate(frame, [delay, delay + 12], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <GlassCard
              key={f.label}
              style={{
                padding: "32px 20px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 14,
                transform: `translateY(${y}px)`,
                opacity: cardOpacity,
              }}
            >
              {/* Icon circle */}
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: `${f.color}18`,
                  border: `1px solid ${f.color}30`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg
                  width={26}
                  height={26}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={f.color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={f.icon} />
                </svg>
              </div>
              <span
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: 16,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.85)",
                  textAlign: "center",
                }}
              >
                {f.label}
              </span>
            </GlassCard>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
