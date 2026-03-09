import { useEffect, useState } from "react";

interface FinanceIntroAnimationProps {
  onComplete: () => void;
}

export function FinanceIntroAnimation({ onComplete }: FinanceIntroAnimationProps) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 100),   // fade in logo
      setTimeout(() => setPhase(2), 400),   // show KPIs
      setTimeout(() => setPhase(3), 700),   // show chart
      setTimeout(() => setPhase(4), 1000),  // fade out
      setTimeout(() => onComplete(), 1400), // done
    ];
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-400 ${
        phase >= 4 ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{
        background: "linear-gradient(135deg, hsl(222 47% 8%) 0%, hsl(222 47% 14%) 50%, hsl(217 60% 12%) 100%)",
      }}
    >
      {/* Logo */}
      <div
        className={`transition-all duration-500 ease-out ${
          phase >= 1 ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-95"
        }`}
      >
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-1">
          CW <span className="text-primary">Finanças</span>
        </h1>
        <p className={`text-sm text-white/50 text-center transition-opacity duration-300 ${
          phase >= 1 ? "opacity-100" : "opacity-0"
        }`}>
          Controle Financeiro Inteligente
        </p>
      </div>

      {/* KPI Pills */}
      <div className={`flex gap-3 mt-8 transition-all duration-500 ease-out ${
        phase >= 2 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      }`}>
        <KPIPill label="Receita" value="+12.4k" color="text-emerald-400" delay={0} />
        <KPIPill label="Despesas" value="-4.1k" color="text-red-400" delay={80} />
        <KPIPill label="Lucro" value="+8.3k" color="text-primary" delay={160} />
      </div>

      {/* Mini Chart */}
      <div className={`mt-6 transition-all duration-500 ease-out ${
        phase >= 3 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}>
        <svg width="200" height="50" viewBox="0 0 200 50" className="overflow-visible">
          <defs>
            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(217 91% 60%)" stopOpacity="0.4" />
              <stop offset="100%" stopColor="hsl(217 91% 60%)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0,45 Q30,40 50,35 T100,20 T150,12 T200,5"
            fill="none"
            stroke="hsl(217 91% 60%)"
            strokeWidth="2"
            className="animate-chart-draw"
            strokeLinecap="round"
          />
          <path
            d="M0,45 Q30,40 50,35 T100,20 T150,12 T200,5 L200,50 L0,50 Z"
            fill="url(#chartGrad)"
            className={`transition-opacity duration-500 ${phase >= 3 ? "opacity-100" : "opacity-0"}`}
          />
        </svg>
      </div>

      <style>{`
        @keyframes chart-draw {
          from { stroke-dashoffset: 300; }
          to { stroke-dashoffset: 0; }
        }
        .animate-chart-draw {
          stroke-dasharray: 300;
          animation: chart-draw 0.8s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

function KPIPill({ label, value, color, delay }: { label: string; value: string; color: string; delay: number }) {
  return (
    <div
      className="flex flex-col items-center px-4 py-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="text-[10px] uppercase tracking-wider text-white/40">{label}</span>
      <span className={`text-sm font-bold tabular-nums ${color}`}>{value}</span>
    </div>
  );
}
