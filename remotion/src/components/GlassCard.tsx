import React from "react";

interface GlassCardProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  highlight?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, style, highlight }) => {
  return (
    <div
      style={{
        background: highlight
          ? "linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(20,184,166,0.08) 100%)"
          : "rgba(255,255,255,0.06)",
        border: highlight
          ? "1px solid rgba(59,130,246,0.3)"
          : "1px solid rgba(255,255,255,0.08)",
        borderRadius: 20,
        boxShadow: highlight
          ? "0 8px 32px rgba(59,130,246,0.15), inset 0 1px 0 rgba(255,255,255,0.1)"
          : "0 4px 24px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.06)",
        ...style,
      }}
    >
      {children}
    </div>
  );
};
