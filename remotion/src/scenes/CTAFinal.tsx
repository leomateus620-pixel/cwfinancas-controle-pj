import { AbsoluteFill, useCurrentFrame, spring, useVideoConfig, interpolate, staticFile, Img } from "remotion";

export const CTAFinal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo
  const logoSpring = spring({ frame, fps, config: { damping: 15, stiffness: 100 } });
  const logoScale = interpolate(logoSpring, [0, 1], [0.6, 1]);
  const logoOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // URL text
  const urlSpring = spring({ frame: frame - 15, fps, config: { damping: 20, stiffness: 200 } });
  const urlY = interpolate(urlSpring, [0, 1], [25, 0]);
  const urlOpacity = interpolate(frame, [15, 28], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Tagline
  const tagOpacity = interpolate(frame, [25, 38], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const tagSpring = spring({ frame: frame - 25, fps, config: { damping: 20, stiffness: 200 } });
  const tagY = interpolate(tagSpring, [0, 1], [15, 0]);

  // Breathing glow
  const breathe = Math.sin(frame * 0.08) * 0.15 + 0.85;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Concentric glow rings */}
      <div
        style={{
          position: "absolute",
          width: 400,
          height: 400,
          borderRadius: "50%",
          border: "1px solid rgba(59,130,246,0.1)",
          opacity: breathe * 0.5,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 550,
          height: 550,
          borderRadius: "50%",
          border: "1px solid rgba(59,130,246,0.05)",
          opacity: breathe * 0.3,
        }}
      />

      {/* Logo */}
      <Img
        src={staticFile("logo-full.png")}
        style={{
          width: 180,
          height: 180,
          objectFit: "contain",
          transform: `scale(${logoScale})`,
          opacity: logoOpacity,
          filter: `drop-shadow(0 0 25px rgba(59,130,246,${breathe * 0.25}))`,
        }}
      />

      {/* URL */}
      <div
        style={{
          position: "absolute",
          top: "64%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 26,
            fontWeight: 600,
            color: "white",
            letterSpacing: "0.05em",
            opacity: urlOpacity,
            transform: `translateY(${urlY}px)`,
          }}
        >
          cwfinancas.app
        </div>
        <div
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 15,
            fontWeight: 500,
            color: "rgba(255,255,255,0.4)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            opacity: tagOpacity,
            transform: `translateY(${tagY}px)`,
          }}
        >
          Gestão Financeira para PJ
        </div>
      </div>
    </AbsoluteFill>
  );
};
