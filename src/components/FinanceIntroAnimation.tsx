import { useEffect, useState } from "react";
import logoCwPj from "@/assets/logo-cw-pj.png";

interface FinanceIntroAnimationProps {
  onComplete: () => void;
}

export function FinanceIntroAnimation({ onComplete }: FinanceIntroAnimationProps) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),    // logo fade + scale
      setTimeout(() => setPhase(2), 800),    // KPIs
      setTimeout(() => setPhase(3), 1500),   // chart
      setTimeout(() => setPhase(4), 2400),   // fade out
      setTimeout(() => onComplete(), 3000),  // done
    ];
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-500 ${
        phase >= 4 ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{
        background: "linear-gradient(135deg, hsl(222 47% 8%) 0%, hsl(222 47% 14%) 50%, hsl(217 60% 12%) 100%)",
      }}
    >
      {/* Logo */}
      <div
        className={`transition-all duration-700 ease-out ${
          phase >= 1 ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-6 scale-90"
        }`}
      >
        <img
          src={logoCwPj}
          alt="CW Finanças"
          className="h-20 md:h-28 w-auto object-contain drop-shadow-2xl"
        />
      </div>

      <p className={`text-sm font-medium text-center mt-3 transition-all duration-500 bg-gradient-to-r from-[hsl(221,85%,53%)] to-[hsl(174,60%,51%)] bg-clip-text text-transparent ${
        phase >= 1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      }`}>
        Controle Financeiro Inteligente
      </p>

      {/* KPI Pills */}
      <div className={`flex gap-3 mt-8 transition-all duration-600 ease-out ${
        phase >= 2 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      }`}>
        <KPIPill label="Receita" value="+12.4k" color="text-emerald-400" />
        <KPIPill label="Despesas" value="-4.1k" color="text-red-400" />
        <KPIPill label="Lucro" value="+8.3k" color="text-primary" />
      </div>

      {/* Mini Chart */}
      <div className={`mt-6 transition-all duration-600 ease-out ${
        phase >= 3 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}>
        <svg width="220" height="55" viewBox="0 0 220 55" className="overflow-visible">
          <defs>
            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(217 91% 60%)" stopOpacity="0.4" />
              <stop offset="100%" stopColor="hsl(217 91% 60%)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0,48 Q35,42 55,36 T110,22 T165,13 T220,5"
            fill="none"
            stroke="hsl(217 91% 60%)"
            strokeWidth="2.5"
            className="animate-chart-draw"
            strokeLinecap="round"
          />
          <path
            d="M0,48 Q35,42 55,36 T110,22 T165,13 T220,5 L220,55 L0,55 Z"
            fill="url(#chartGrad)"
            className={`transition-opacity duration-700 ${phase >= 3 ? "opacity-100" : "opacity-0"}`}
          />
        </svg>
      </div>

      <style>{`
        @keyframes chart-draw {
          from { stroke-dashoffset: 320; }
          to { stroke-dashoffset: 0; }
        }
        .animate-chart-draw {
          stroke-dasharray: 320;
          animation: chart-draw 1s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

function KPIPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col items-center px-4 py-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
      <span className="text-[10px] uppercase tracking-wider text-white/40">{label}</span>
      <span className={`text-sm font-bold tabular-nums ${color}`}>{value}</span>
    </div>
  );
}