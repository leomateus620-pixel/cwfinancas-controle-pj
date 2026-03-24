import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

export const GlassBackground: React.FC = () => {
  const frame = useCurrentFrame();

  // Slow drifting orbs
  const orb1X = interpolate(frame, [0, 450], [0, 60], { extrapolateRight: "clamp" });
  const orb1Y = Math.sin(frame * 0.012) * 30;
  const orb2X = interpolate(frame, [0, 450], [0, -40], { extrapolateRight: "clamp" });
  const orb2Y = Math.cos(frame * 0.01) * 25;
  const orb3X = Math.sin(frame * 0.008) * 35;
  const orb3Y = interpolate(frame, [0, 450], [0, 50], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      {/* Base navy gradient */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(135deg, hsl(222 47% 9%) 0%, hsl(222 47% 13%) 40%, hsl(230 40% 11%) 100%)",
        }}
      />

      {/* Mesh gradient texture */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 600px 600px at 20% 30%, rgba(59,130,246,0.12) 0%, transparent 70%), " +
            "radial-gradient(ellipse 500px 500px at 80% 70%, rgba(20,184,166,0.08) 0%, transparent 70%), " +
            "radial-gradient(ellipse 400px 400px at 50% 50%, rgba(59,130,246,0.05) 0%, transparent 60%)",
        }}
      />

      {/* Floating orb 1 - blue */}
      <div
        style={{
          position: "absolute",
          width: 350,
          height: 350,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)",
          top: -60 + orb1Y,
          left: -80 + orb1X,
          filter: "blur(40px)",
        }}
      />

      {/* Floating orb 2 - teal */}
      <div
        style={{
          position: "absolute",
          width: 300,
          height: 300,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(20,184,166,0.12) 0%, transparent 70%)",
          bottom: -40 + orb2Y,
          right: -60 + orb2X,
          filter: "blur(35px)",
        }}
      />

      {/* Floating orb 3 - purple accent */}
      <div
        style={{
          position: "absolute",
          width: 250,
          height: 250,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)",
          top: "40%",
          left: "50%",
          transform: `translate(${orb3X}px, ${orb3Y}px)`,
          filter: "blur(30px)",
        }}
      />

      {/* Subtle noise overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.03,
          backgroundImage:
            `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "128px 128px",
        }}
      />
    </AbsoluteFill>
  );
};
