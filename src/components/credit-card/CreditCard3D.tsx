import { useCallback, useRef, useState } from "react";
import cardBlackPremium from "@/assets/cards/card-black-premium.png";

interface CreditCard3DProps {
  assetOverride?: string | null;
  className?: string;
}

export function CreditCard3D({
  assetOverride,
  className = "",
}: CreditCard3DProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState("rotateY(-6deg) rotateX(4deg)");
  const [glare, setGlare] = useState({ x: 50, y: 50, opacity: 0 });
  const rafRef = useRef<number | null>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      const el = cardRef.current;
      if (!el) { rafRef.current = null; return; }
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      setTransform(`rotateY(${x * 14}deg) rotateX(${-y * 10}deg)`);
      setGlare({ x: (x + 0.5) * 100, y: (y + 0.5) * 100, opacity: 0.25 });
      rafRef.current = null;
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setTransform("rotateY(-6deg) rotateX(4deg)");
    setGlare({ x: 50, y: 50, opacity: 0 });
  }, []);

  const src = assetOverride || cardBlackPremium;

  return (
    <div
      className={`credit-card-3d-wrapper ${className}`}
      style={{ perspective: "1000px" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div
        ref={cardRef}
        className="credit-card-3d relative w-[340px] h-[215px] rounded-2xl overflow-hidden transition-transform duration-300 ease-out will-change-transform"
        style={{
          transform,
          transformStyle: "preserve-3d",
        }}
      >
        <img
          src={src}
          alt="Cartão de crédito corporativo"
          className="absolute inset-0 w-full h-full object-cover rounded-2xl"
          draggable={false}
        />

        {/* Dynamic glare */}
        <div
          className="absolute inset-0 pointer-events-none rounded-2xl transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,0.35) 0%, transparent 60%)`,
            opacity: glare.opacity,
          }}
        />

        {/* Edge highlight */}
        <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10 pointer-events-none" />
      </div>

      {/* Reflection shadow */}
      <div
        className="mx-auto mt-2 h-5 rounded-full blur-2xl opacity-30"
        style={{ width: "75%", background: "rgba(0,0,0,0.6)" }}
      />
    </div>
  );
}
