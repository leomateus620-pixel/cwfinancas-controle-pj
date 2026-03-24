import { AbsoluteFill, useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";

const words = ["Seu", "Financeiro", "Controlado", "com", "um", "Clique"];

export const HeroPhrase: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Exit
  const exitOpacity = interpolate(frame, [90, 105], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Underline wipe for "Controlado"
  const underlineProgress = interpolate(frame, [35, 55], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: exitOpacity,
      }}
    >
      {/* Glow backdrop */}
      <div
        style={{
          position: "absolute",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)",
          filter: "blur(40px)",
          opacity: interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      />

      {/* Words */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "12px 18px",
          maxWidth: 800,
          padding: "0 40px",
          position: "relative",
        }}
      >
        {words.map((word, i) => {
          const delay = 5 + i * 7;
          const s = spring({ frame: frame - delay, fps, config: { damping: 15, stiffness: 150 } });
          const y = interpolate(s, [0, 1], [60, 0]);
          const opacity = interpolate(frame, [delay, delay + 10], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const isHighlight = word === "Controlado";

          return (
            <span
              key={i}
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: isHighlight ? 72 : word === "com" || word === "um" ? 52 : 64,
                fontWeight: isHighlight ? 800 : word === "com" || word === "um" ? 400 : 700,
                color: isHighlight ? "#3B82F6" : "white",
                letterSpacing: "-0.03em",
                transform: `translateY(${y}px)`,
                opacity,
                position: "relative",
                display: "inline-block",
                textShadow: isHighlight ? "0 0 40px rgba(59,130,246,0.4)" : "none",
              }}
            >
              {word}
              {isHighlight && (
                <div
                  style={{
                    position: "absolute",
                    bottom: -4,
                    left: 0,
                    width: `${underlineProgress * 100}%`,
                    height: 4,
                    background: "linear-gradient(90deg, #3B82F6, #14B8A6)",
                    borderRadius: 2,
                  }}
                />
              )}
            </span>
          );
        })}
      </div>

      {/* Decorative accent line */}
      <div
        style={{
          position: "absolute",
          bottom: 220,
          width: interpolate(frame, [50, 70], [0, 200], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          height: 1,
          background: "linear-gradient(90deg, transparent, rgba(59,130,246,0.3), transparent)",
        }}
      />
    </AbsoluteFill>
  );
};
