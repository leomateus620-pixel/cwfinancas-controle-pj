import { AbsoluteFill, useCurrentFrame, spring, useVideoConfig, interpolate, staticFile, Img } from "remotion";

export const LogoReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo scale + opacity
  const logoScale = spring({ frame, fps, config: { damping: 15, stiffness: 80, mass: 1.2 } });
  const logoOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });

  // Glow ring
  const ringScale = spring({ frame: frame - 5, fps, config: { damping: 20, stiffness: 120 } });
  const ringOpacity = interpolate(frame, [5, 25, 55, 75], [0, 0.6, 0.6, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Tagline
  const tagSpring = spring({ frame: frame - 25, fps, config: { damping: 20, stiffness: 200 } });
  const tagY = interpolate(tagSpring, [0, 1], [30, 0]);
  const tagOpacity = interpolate(frame, [25, 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Subtitle
  const subSpring = spring({ frame: frame - 38, fps, config: { damping: 20, stiffness: 200 } });
  const subY = interpolate(subSpring, [0, 1], [20, 0]);
  const subOpacity = interpolate(frame, [38, 50], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Exit fade
  const exitOpacity = interpolate(frame, [60, 75], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: exitOpacity,
      }}
    >
      {/* Glow ring behind logo */}
      <div
        style={{
          position: "absolute",
          width: 280,
          height: 280,
          borderRadius: "50%",
          border: "2px solid rgba(59,130,246,0.3)",
          boxShadow: "0 0 60px rgba(59,130,246,0.2), inset 0 0 40px rgba(59,130,246,0.1)",
          transform: `scale(${ringScale})`,
          opacity: ringOpacity,
        }}
      />

      {/* Logo */}
      <Img
        src={staticFile("logo-cw-pj.png")}
        style={{
          width: 200,
          height: 200,
          objectFit: "contain",
          transform: `scale(${logoScale})`,
          opacity: logoOpacity,
          filter: "drop-shadow(0 0 30px rgba(59,130,246,0.3))",
        }}
      />

      {/* Tagline */}
      <div
        style={{
          position: "absolute",
          top: "62%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 38,
            fontWeight: 700,
            color: "white",
            letterSpacing: "-0.02em",
            opacity: tagOpacity,
            transform: `translateY(${tagY}px)`,
          }}
        >
          CW Finanças
        </div>
        <div
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 18,
            fontWeight: 500,
            color: "rgba(59,130,246,0.8)",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            opacity: subOpacity,
            transform: `translateY(${subY}px)`,
          }}
        >
          Controle PJ
        </div>
      </div>
    </AbsoluteFill>
  );
};
