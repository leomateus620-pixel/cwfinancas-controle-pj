import { useCallback, useRef, useState } from "react";
import { CardBrand, GENERIC_BRAND } from "@/lib/cardCatalog";
import { formatCurrencyBR } from "@/lib/currency";

interface CreditCard3DProps {
  brand: CardBrand;
  totalNet?: number;
  dueDate?: string;
  cycleLabel?: string;
  className?: string;
}

export function CreditCard3D({
  brand,
  totalNet,
  dueDate,
  cycleLabel,
  className = "",
}: CreditCard3DProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState("rotateX(0deg) rotateY(0deg)");
  const rafRef = useRef<number | null>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      const el = cardRef.current;
      if (!el) { rafRef.current = null; return; }
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      setTransform(`rotateY(${x * 12}deg) rotateX(${-y * 12}deg)`);
      rafRef.current = null;
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setTransform("rotateX(0deg) rotateY(0deg)");
  }, []);

  const hasAsset = brand.asset !== null;

  return (
    <div
      className={`credit-card-3d-wrapper ${className}`}
      style={{ perspective: "1200px" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div
        ref={cardRef}
        className="credit-card-3d relative w-[340px] h-[215px] rounded-2xl overflow-hidden transition-transform duration-200 ease-out will-change-transform"
        style={{
          transform,
          transformStyle: "preserve-3d",
        }}
      >
        {/* Card background */}
        {hasAsset ? (
          <img
            src={brand.asset!}
            alt={brand.name}
            className="absolute inset-0 w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: brand.gradient }}
          />
        )}

        {/* Glow overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-black/10 pointer-events-none" />

        {/* Reflection shine */}
        <div
          className="absolute inset-0 pointer-events-none opacity-30"
          style={{
            background:
              "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.5) 45%, rgba(255,255,255,0.1) 50%, transparent 55%)",
          }}
        />

        {/* Info overlay — only show on generic card */}
        {!hasAsset && (
          <div className="absolute inset-0 p-5 flex flex-col justify-between" style={{ color: brand.textColor }}>
            <div>
              <p className="text-xs font-medium opacity-70 tracking-widest uppercase">
                {cycleLabel || "Cartão Corporativo"}
              </p>
              <p className="text-lg font-bold mt-1">{brand.name}</p>
            </div>
            <div className="flex items-end justify-between">
              {totalNet !== undefined && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider opacity-60">Total Líquido</p>
                  <p className="text-xl font-bold tabular-nums">{formatCurrency(totalNet)}</p>
                </div>
              )}
              {dueDate && (
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider opacity-60">Vencimento</p>
                  <p className="text-sm font-semibold">{dueDate}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Subtle border glow */}
        <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/20 pointer-events-none" />
      </div>

      {/* Shadow below card */}
      <div
        className="mx-auto mt-1 h-4 rounded-full blur-xl opacity-40"
        style={{
          width: "80%",
          background: brand.accentColor,
        }}
      />
    </div>
  );
}
