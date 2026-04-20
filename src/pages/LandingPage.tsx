import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import {
  LogIn,
  UserPlus,
  Home,
  LayoutDashboard,
  DollarSign,
  CreditCard,
  ArrowRightLeft,
  FileText,
  Receipt,
  LineChart,
  Sparkles,
  ChevronRight,
  Wallet,
  Brain,
  Building2,
  FileSpreadsheet,
  ScanLine,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import logoFull from "@/assets/logo-full.png";

const features = [
  { icon: Home, label: "Home", color: "hsl(221 85% 53%)" },
  { icon: LayoutDashboard, label: "Dashboard", color: "hsl(221 85% 53%)" },
  { icon: DollarSign, label: "Receitas", color: "hsl(160 84% 39%)" },
  { icon: Wallet, label: "Despesas", color: "hsl(0 72% 51%)" },
  { icon: CreditCard, label: "Cartão de Crédito", color: "hsl(280 75% 60%)" },
  { icon: ArrowRightLeft, label: "Fluxo de Caixa", color: "hsl(199 89% 48%)" },
  { icon: FileText, label: "DRE", color: "hsl(262 83% 58%)" },
  { icon: Receipt, label: "Contas a Pagar/Receber", color: "hsl(38 92% 50%)" },
  { icon: LineChart, label: "Previsões", color: "hsl(173 80% 40%)" },
  { icon: Brain, label: "Insights IA", color: "hsl(330 81% 60%)" },
  { icon: Building2, label: "Minha Empresa", color: "hsl(217 91% 60%)" },
];

const highlights = [
  {
    icon: FileText,
    title: "DRE Inteligente",
    description: "Resultado financeiro consolidado com validação automática e visão por núcleo de negócio",
    accent: "hsl(262 83% 58%)",
    isNew: false,
  },
  {
    icon: TrendingUp,
    title: "Previsões com IA",
    description: "Cenários Conservador, Base e Otimista para 12 meses",
    accent: "hsl(173 80% 40%)",
    isNew: false,
  },
  {
    icon: CreditCard,
    title: "Cartão de Crédito",
    description: "Detecção automática de faturas, ciclos e reembolsos",
    accent: "hsl(280 75% 60%)",
    isNew: true,
  },
  {
    icon: ScanLine,
    title: "Conversor de Extratos",
    description: "PDFs de bancos viram planilhas via OCR inteligente",
    accent: "hsl(38 92% 50%)",
    isNew: true,
  },
  {
    icon: Sparkles,
    title: "Insights Premium",
    description: "Saúde, Riscos, Oportunidades e Anomalias por IA",
    accent: "hsl(330 81% 60%)",
    isNew: true,
  },
  {
    icon: ShieldCheck,
    title: "Dados Protegidos",
    description: "RLS, criptografia e conformidade total com LGPD",
    accent: "hsl(160 84% 39%)",
    isNew: false,
  },
];

/* ── Highlights Carousel ── */
const HighlightsCarousel = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goTo = useCallback((idx: number) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setActiveIndex(idx);
      setIsTransitioning(false);
    }, 400);
  }, [isTransitioning]);

  const advance = useCallback(() => {
    goTo((activeIndex + 1) % highlights.length);
  }, [activeIndex, goTo]);

  useEffect(() => {
    if (isPaused) return;
    timerRef.current = setInterval(advance, 4000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [advance, isPaused]);

  const h = highlights[activeIndex];

  return (
    <div
      className="opacity-0 animate-fade-in-up"
      style={{ animationDelay: "400ms", animationFillMode: "forwards" }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Card */}
      <div
        className="relative rounded-2xl p-[1px] min-h-[120px]"
        style={{
          background: `linear-gradient(135deg, ${h.accent.replace(")", " / 0.5)")}, transparent 60%, ${h.accent.replace(")", " / 0.25)")})`,
        }}
      >
        <div
          className="liquid-glass-compact !rounded-2xl px-5 py-5 flex items-start gap-4 relative overflow-hidden"
          style={{
            opacity: isTransitioning ? 0 : 1,
            transform: isTransitioning
              ? "translateY(20px) scale(0.95)"
              : "translateY(0) scale(1)",
            filter: isTransitioning ? "blur(4px)" : "blur(0)",
            transition: isTransitioning
              ? "opacity 0.4s ease-in, transform 0.4s ease-in, filter 0.4s ease-in"
              : "opacity 0.5s cubic-bezier(0.34,1.56,0.64,1), transform 0.5s cubic-bezier(0.34,1.56,0.64,1), filter 0.5s ease-out",
          }}
        >
          {/* Ambient glow */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(circle at top right, ${h.accent.replace(")", " / 0.1)")}, transparent 70%)`,
            }}
          />
          {/* Icon */}
          <div
            className="relative w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: `linear-gradient(135deg, ${h.accent.replace(")", " / 0.2)")}, ${h.accent.replace(")", " / 0.06)")})`,
              boxShadow: `0 6px 20px -6px ${h.accent.replace(")", " / 0.5)")}, inset 0 1px 0 ${h.accent.replace(")", " / 0.25)")}`,
            }}
          >
            <h.icon className="w-6 h-6" style={{ color: h.accent }} />
          </div>
          {/* Text */}
          <div className="text-left min-w-0 flex-1 relative">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-base font-bold text-foreground leading-tight">{h.title}</p>
              {h.isNew && (
                <span
                  className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0"
                  style={{
                    background: `${h.accent.replace(")", " / 0.15)")}`,
                    color: h.accent,
                    border: `1px solid ${h.accent.replace(")", " / 0.3)")}`,
                  }}
                >
                  Novo
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{h.description}</p>
          </div>
        </div>
      </div>

      {/* Navigation dots */}
      <div className="flex items-center justify-center gap-2 mt-3">
        {highlights.map((item, i) => (
          <button
            key={item.title}
            onClick={() => goTo(i)}
            className="transition-all duration-300 rounded-full"
            style={{
              width: i === activeIndex ? 24 : 8,
              height: 8,
              background: i === activeIndex
                ? item.accent
                : `${item.accent.replace(")", " / 0.25)")}`,
              opacity: i === activeIndex ? 1 : 0.6,
            }}
            aria-label={`Ver ${item.title}`}
          />
        ))}
      </div>
    </div>
  );
};


const chartMonths = ["Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const revenueData = [62, 70, 58, 78, 85, 92]; // % normalizado
const expenseData = [48, 52, 45, 58, 60, 65];

// Helper para criar path suavizado (curva tipo cardinal)
const buildSmoothPath = (points: { x: number; y: number }[]) => {
  if (points.length < 2) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
};

const W = 320;
const H = 110;
const PAD_X = 10;
const PAD_Y = 10;

const toPoints = (values: number[]) =>
  values.map((v, i) => ({
    x: PAD_X + (i * (W - PAD_X * 2)) / (values.length - 1),
    y: H - PAD_Y - ((v - 30) / 70) * (H - PAD_Y * 2),
  }));

const revenuePoints = toPoints(revenueData);
const expensePoints = toPoints(expenseData);
const revenuePath = buildSmoothPath(revenuePoints);
const expensePath = buildSmoothPath(expensePoints);
const areaPath = `${revenuePath} L ${revenuePoints[revenuePoints.length - 1].x} ${H - PAD_Y} L ${revenuePoints[0].x} ${H - PAD_Y} Z`;

export default function LandingPage() {
  useEffect(() => {
    document.title = "CW Finanças – Gestão Financeira para PJ";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute(
        "content",
        "CW Finanças é uma plataforma de gestão financeira para pessoas jurídicas. Controle receitas, despesas, fluxo de caixa, DRE e muito mais."
      );
    }
  }, []);

  const lastRev = revenuePoints[revenuePoints.length - 1];

  return (
    <div className="min-h-screen flex flex-col home-glass-bg relative overflow-hidden">
      {/* Decorative floating orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div
          className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-[0.07] animate-float"
          style={{ background: "radial-gradient(circle, hsl(221 85% 53%), transparent 70%)" }}
        />
        <div
          className="absolute top-1/3 -right-24 w-80 h-80 rounded-full opacity-[0.05] animate-float"
          style={{ background: "radial-gradient(circle, hsl(173 80% 40%), transparent 70%)", animationDelay: "2s" }}
        />
        <div
          className="absolute -bottom-20 left-1/3 w-72 h-72 rounded-full opacity-[0.04] animate-float"
          style={{ background: "radial-gradient(circle, hsl(262 83% 58%), transparent 70%)", animationDelay: "4s" }}
        />
      </div>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-4 md:p-8 relative z-10">
        <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-8 lg:gap-12 items-center">
          {/* Left Column – Text & CTAs */}
          <div className="text-center lg:text-left space-y-7">
            {/* Logo */}
            <div
              className="opacity-0 animate-fade-in-up"
              style={{ animationDelay: "100ms", animationFillMode: "forwards" }}
            >
              <img
                src={logoFull}
                alt="CW Finanças"
                className="w-[140px] h-[140px] md:w-[170px] md:h-[170px] mx-auto lg:mx-0 object-contain drop-shadow-lg"
              />
            </div>

            {/* Hero text */}
            <div
              className="space-y-4 opacity-0 animate-fade-in-up"
              style={{ animationDelay: "250ms", animationFillMode: "forwards" }}
            >
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground tracking-tight leading-tight">
                Gestão Financeira{" "}
                <span className="gradient-text-primary">Inteligente</span>{" "}
                para PJ
              </h1>
              <p className="text-muted-foreground text-base md:text-lg leading-relaxed max-w-lg mx-auto lg:mx-0">
                Controle receitas, despesas, fluxo de caixa, DRE e contas a
                pagar/receber da sua empresa em um só lugar. Integre com Google
                Sheets e obtenha insights com inteligência artificial.
              </p>
            </div>

            {/* Highlights — Animated Single-Card Carousel */}
            <HighlightsCarousel />

            {/* CTAs */}
            <div
              className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 opacity-0 animate-fade-in-up"
              style={{ animationDelay: "650ms", animationFillMode: "forwards" }}
            >
              <Button
                asChild
                className="w-full sm:w-auto gap-2 h-12 px-8 rounded-2xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/20 text-primary-foreground font-semibold text-base transition-all duration-300 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5"
              >
                <Link to="/login">
                  <LogIn className="w-4 h-4" />
                  Entrar
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="w-full sm:w-auto gap-2 h-12 px-8 rounded-2xl border-border/60 hover:border-primary/30 transition-all duration-300 hover:-translate-y-0.5 font-semibold text-base"
              >
                <Link to="/register">
                  <UserPlus className="w-4 h-4" />
                  Criar conta
                </Link>
              </Button>
            </div>
          </div>

          {/* Right Column – 3D Mock App Preview */}
          <div
            className="relative opacity-0 animate-fade-in-up hidden lg:block group/mock"
            style={{
              animationDelay: "400ms",
              animationFillMode: "forwards",
              perspective: "1400px",
            }}
          >
            {/* Glow behind the preview */}
            <div
              className="absolute -inset-12 rounded-[40px] opacity-40 blur-3xl pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse at 60% 40%, hsl(221 85% 53% / 0.25), hsl(173 80% 40% / 0.12), transparent 70%)",
              }}
            />

            {/* 3D Wrapper */}
            <div
              className="relative transition-transform duration-700 ease-out"
              style={{
                transform: "rotateY(-13deg) rotateX(7deg) rotateZ(-1deg)",
                transformStyle: "preserve-3d",
              }}
            >
              {/* Drop shadow projetada */}
              <div
                className="absolute inset-0 rounded-3xl pointer-events-none"
                style={{
                  boxShadow:
                    "40px 60px 100px -30px hsl(221 85% 20% / 0.5), 20px 30px 60px -20px hsl(221 85% 30% / 0.3)",
                  transform: "translateZ(-40px)",
                }}
              />

              {/* Mock Window */}
              <div
                className="liquid-glass p-0 overflow-hidden relative"
                style={{ borderRadius: "24px", transformStyle: "preserve-3d" }}
              >
                {/* Diagonal glare */}
                <div
                  className="absolute inset-0 pointer-events-none z-20 opacity-60"
                  style={{
                    background:
                      "linear-gradient(115deg, transparent 30%, hsl(0 0% 100% / 0.08) 45%, hsl(0 0% 100% / 0.14) 50%, hsl(0 0% 100% / 0.08) 55%, transparent 70%)",
                    borderRadius: "24px",
                  }}
                />

                {/* Title bar */}
                <div className="flex items-center gap-2 px-5 py-3 border-b border-border/30 relative z-10">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-destructive/60" />
                    <div className="w-3 h-3 rounded-full bg-warning/60" />
                    <div className="w-3 h-3 rounded-full bg-success/60" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="px-4 py-1 rounded-lg bg-muted/50 text-[10px] text-muted-foreground font-medium tracking-wide">
                      cwfinancas.app
                    </div>
                  </div>
                </div>

                {/* Mock app body */}
                <div className="flex min-h-[440px] relative z-10">
                  {/* Sidebar */}
                  <div className="w-56 border-r border-border/20 py-4 px-3 space-y-1 bg-gradient-to-b from-primary/[0.04] to-transparent">
                    <div className="flex items-center gap-2 px-2 mb-4">
                      <img src={logoFull} alt="" className="w-7 h-7 object-contain" />
                      <span className="text-xs font-bold text-foreground">CW Finanças</span>
                    </div>

                    {features.map((f, i) => (
                      <div
                        key={f.label}
                        className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs transition-all duration-500 opacity-0 animate-icon-pop group/item hover:bg-primary/5 cursor-default"
                        style={{
                          animationDelay: `${800 + i * 70}ms`,
                          animationFillMode: "forwards",
                          transformStyle: "preserve-3d",
                        }}
                      >
                        <div
                          className="relative w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all duration-500 group-hover/item:scale-125 animate-icon-float"
                          style={{
                            background: `linear-gradient(135deg, ${f.color.replace(")", " / 0.18)")}, ${f.color.replace(")", " / 0.05)")})`,
                            boxShadow: `0 2px 8px -2px ${f.color.replace(")", " / 0.35)")}, inset 0 1px 0 ${f.color.replace(")", " / 0.2)")}`,
                            transform: "translateZ(20px)",
                            animationDelay: `${i * 0.4}s`,
                          }}
                        >
                          <f.icon className="w-3.5 h-3.5" style={{ color: f.color }} />
                        </div>
                        <span className="text-muted-foreground font-medium group-hover/item:text-foreground transition-colors text-[11px]">
                          {f.label}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Content area */}
                  <div className="flex-1 p-5 space-y-4 overflow-hidden" style={{ transformStyle: "preserve-3d" }}>
                    {/* Header */}
                    <div
                      className="opacity-0 animate-fade-in-up"
                      style={{ animationDelay: "1000ms", animationFillMode: "forwards" }}
                    >
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">
                        Painel Financeiro
                      </p>
                      <p className="text-lg font-bold text-foreground">Bem-vindo 👋</p>
                    </div>

                    {/* Mini KPI cards with 3D depth */}
                    <div className="grid grid-cols-3 gap-2.5">
                      {[
                        { label: "Receitas", value: "R$ 84.200", color: "text-success", glow: "hsl(160 84% 39%)", delay: 1100 },
                        { label: "Despesas", value: "R$ 52.800", color: "text-destructive", glow: "hsl(0 72% 51%)", delay: 1200 },
                        { label: "Lucro", value: "R$ 31.400", color: "text-primary", glow: "hsl(221 85% 53%)", delay: 1300 },
                      ].map((kpi) => (
                        <div
                          key={kpi.label}
                          className="liquid-glass-compact p-3 opacity-0 animate-fade-in-up relative"
                          style={{
                            animationDelay: `${kpi.delay}ms`,
                            animationFillMode: "forwards",
                            borderRadius: "14px",
                            transform: "translateZ(15px)",
                            boxShadow: `0 8px 20px -8px ${kpi.glow.replace(")", " / 0.3)")}`,
                          }}
                        >
                          <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider">
                            {kpi.label}
                          </p>
                          <p className={`text-sm font-bold tabular-nums ${kpi.color}`}>
                            {kpi.value}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Real SVG Chart - Evolução Mensal */}
                    <div
                      className="liquid-glass-compact p-3.5 opacity-0 animate-fade-in-up relative"
                      style={{
                        animationDelay: "1400ms",
                        animationFillMode: "forwards",
                        borderRadius: "14px",
                        transform: "translateZ(20px)",
                        boxShadow: "0 12px 30px -10px hsl(221 85% 30% / 0.25)",
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider">
                          Evolução Mensal
                        </p>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-success" />
                            <span className="text-[8px] text-muted-foreground">Receitas</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-destructive" />
                            <span className="text-[8px] text-muted-foreground">Despesas</span>
                          </div>
                        </div>
                      </div>

                      <svg
                        viewBox={`0 0 ${W} ${H + 14}`}
                        className="w-full h-[110px] overflow-visible"
                        preserveAspectRatio="none"
                      >
                        <defs>
                          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(160 84% 39%)" stopOpacity="0.35" />
                            <stop offset="100%" stopColor="hsl(160 84% 39%)" stopOpacity="0" />
                          </linearGradient>
                          <filter id="dotGlow">
                            <feGaussianBlur stdDeviation="2" result="blur" />
                            <feMerge>
                              <feMergeNode in="blur" />
                              <feMergeNode in="SourceGraphic" />
                            </feMerge>
                          </filter>
                        </defs>

                        {/* Horizontal grid lines */}
                        {[0.25, 0.5, 0.75].map((p) => (
                          <line
                            key={p}
                            x1={PAD_X}
                            x2={W - PAD_X}
                            y1={PAD_Y + p * (H - PAD_Y * 2)}
                            y2={PAD_Y + p * (H - PAD_Y * 2)}
                            stroke="hsl(var(--border))"
                            strokeOpacity="0.2"
                            strokeDasharray="2 4"
                          />
                        ))}

                        {/* Area under revenue */}
                        <path
                          d={areaPath}
                          fill="url(#revGrad)"
                          className="animate-fade-in"
                          style={{ animationDelay: "1700ms", animationFillMode: "both" }}
                        />

                        {/* Expense line (drawn first - background) */}
                        <path
                          d={expensePath}
                          fill="none"
                          stroke="hsl(0 72% 51%)"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeDasharray="600"
                          strokeDashoffset="600"
                          style={{
                            animation: "draw-line 1.8s ease-out 1.6s forwards",
                          }}
                        />

                        {/* Revenue line */}
                        <path
                          d={revenuePath}
                          fill="none"
                          stroke="hsl(160 84% 39%)"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeDasharray="600"
                          strokeDashoffset="600"
                          style={{
                            animation: "draw-line 1.8s ease-out 1.5s forwards",
                          }}
                        />

                        {/* Highlight dots - revenue peaks */}
                        {[2, 4, 5].map((idx) => (
                          <g key={idx}>
                            <circle
                              cx={revenuePoints[idx].x}
                              cy={revenuePoints[idx].y}
                              r="4"
                              fill="hsl(160 84% 39%)"
                              opacity="0.25"
                              className="animate-pulse"
                            />
                            <circle
                              cx={revenuePoints[idx].x}
                              cy={revenuePoints[idx].y}
                              r="2.2"
                              fill="hsl(160 84% 39%)"
                              filter="url(#dotGlow)"
                              opacity="0"
                              style={{
                                animation: `fade-in 0.5s ease-out ${2.2 + idx * 0.1}s forwards`,
                              }}
                            />
                          </g>
                        ))}

                        {/* Tooltip on last point */}
                        <g
                          opacity="0"
                          style={{ animation: "fade-in 0.5s ease-out 2.6s forwards" }}
                        >
                          <rect
                            x={lastRev.x - 38}
                            y={lastRev.y - 24}
                            width="38"
                            height="16"
                            rx="4"
                            fill="hsl(var(--foreground))"
                            opacity="0.9"
                          />
                          <text
                            x={lastRev.x - 19}
                            y={lastRev.y - 13}
                            textAnchor="middle"
                            fontSize="7.5"
                            fill="hsl(var(--background))"
                            fontWeight="600"
                          >
                            Dez · R$ 31.4k
                          </text>
                        </g>

                        {/* X-axis labels */}
                        {chartMonths.map((m, i) => (
                          <text
                            key={m}
                            x={PAD_X + (i * (W - PAD_X * 2)) / (chartMonths.length - 1)}
                            y={H + 8}
                            textAnchor="middle"
                            fontSize="7"
                            fill="hsl(var(--muted-foreground))"
                            fontWeight="500"
                          >
                            {m}
                          </text>
                        ))}
                      </svg>
                    </div>

                    {/* AI Insight badge */}
                    <div
                      className="liquid-glass-highlight flex items-center gap-2.5 p-3 opacity-0 animate-fade-in-up relative"
                      style={{
                        animationDelay: "1800ms",
                        animationFillMode: "forwards",
                        borderRadius: "14px",
                        transform: "translateZ(25px)",
                        boxShadow: "0 10px 25px -8px hsl(221 85% 30% / 0.3)",
                      }}
                    >
                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center animate-pulse-glow">
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] text-primary font-semibold uppercase tracking-wider">
                          Insight IA
                        </p>
                        <p className="text-[10px] text-muted-foreground leading-tight truncate">
                          Receitas cresceram 12% vs. mês anterior
                        </p>
                      </div>
                      <ChevronRight className="w-3 h-3 text-muted-foreground/40" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center space-y-2 relative z-10">
        <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
          <Link
            to="/politica-de-privacidade"
            className="hover:text-primary hover:underline transition-colors"
          >
            Política de Privacidade
          </Link>
          <span>•</span>
          <Link
            to="/termos-de-uso"
            className="hover:text-primary hover:underline transition-colors"
          >
            Termos de Uso
          </Link>
        </div>
        <p className="text-xs text-muted-foreground/60">
          © {new Date().getFullYear()} CW Finanças. Todos os direitos
          reservados.
        </p>
      </footer>
    </div>
  );
}
