import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Home,
  LayoutDashboard,
  DollarSign,
  Wallet,
  CreditCard,
  ArrowRightLeft,
  FileText,
  Receipt,
  LineChart,
  Brain,
  Building2,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Send,
  Inbox,
  CalendarClock,
  Tag,
  AlertCircle,
} from "lucide-react";
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
  { icon: Inbox, label: "Demandas", color: "hsl(199 89% 48%)", active: true },
  { icon: Building2, label: "Minha Empresa", color: "hsl(217 91% 60%)" },
];

const TYPED_TEXT =
  "Pagar fornecedor Acme — R$ 1.400,00, vencimento 25/05. NF em anexo.";

const chips = [
  { icon: Tag, label: "Pagamento", color: "hsl(221 85% 53%)", delay: 2100 },
  { icon: DollarSign, label: "R$ 1.400,00", color: "hsl(160 84% 39%)", delay: 2250 },
  { icon: CalendarClock, label: "25/05", color: "hsl(38 92% 50%)", delay: 2400 },
  { icon: AlertCircle, label: "Normal", color: "hsl(280 75% 60%)", delay: 2550 },
];

function useTypewriter(text: string, startDelay = 1000, speed = 28) {
  const [out, setOut] = useState("");
  useEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      setOut(text);
      return;
    }
    setOut("");
    let i = 0;
    let raf = 0;
    const startTimer = window.setTimeout(() => {
      const tick = () => {
        i += 1;
        setOut(text.slice(0, i));
        if (i < text.length) {
          raf = window.setTimeout(tick, speed) as unknown as number;
        }
      };
      tick();
    }, startDelay);
    return () => {
      window.clearTimeout(startTimer);
      window.clearTimeout(raf);
    };
  }, [text, startDelay, speed]);
  return out;
}

export function MockDemandCard() {
  const typed = useTypewriter(TYPED_TEXT, 900, 26);

  return (
    <div
      className="relative transition-transform duration-700 ease-out"
      style={{
        transform: "rotateY(-13deg) rotateX(7deg) rotateZ(-1deg)",
        transformStyle: "preserve-3d",
      }}
    >
      {/* Drop shadow */}
      <div
        className="absolute inset-0 rounded-3xl pointer-events-none"
        style={{
          boxShadow:
            "40px 60px 100px -30px hsl(199 89% 25% / 0.5), 20px 30px 60px -20px hsl(199 89% 35% / 0.3)",
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
              cwfinancas.app/demandas
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex min-h-[440px] relative z-10">
          {/* Sidebar */}
          <div className="w-56 border-r border-border/20 py-4 px-3 space-y-1 bg-gradient-to-b from-primary/[0.04] to-transparent">
            <div className="flex items-center gap-2 px-2 mb-4">
              <img src={logoFull} alt="" className="w-7 h-7 object-contain" />
              <span className="text-xs font-bold text-foreground">CW Finanças</span>
            </div>

            {features.map((f, i) => {
              const isActive = (f as { active?: boolean }).active === true;
              return (
                <div
                  key={f.label}
                  className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs transition-all duration-500 opacity-0 animate-icon-pop group/item cursor-default ${
                    isActive
                      ? "bg-primary/10 ring-1 ring-primary/30"
                      : "hover:bg-primary/5"
                  }`}
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
                      transform: isActive ? "translateZ(28px)" : "translateZ(20px)",
                      animationDelay: `${i * 0.4}s`,
                    }}
                  >
                    <f.icon className="w-3.5 h-3.5" style={{ color: f.color }} />
                  </div>
                  <span
                    className={`font-medium transition-colors text-[11px] ${
                      isActive
                        ? "text-foreground font-semibold"
                        : "text-muted-foreground group-hover/item:text-foreground"
                    }`}
                  >
                    {f.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Content */}
          <div
            className="flex-1 p-5 space-y-4 overflow-hidden"
            style={{ transformStyle: "preserve-3d" }}
          >
            {/* Header */}
            <div
              className="opacity-0 animate-fade-in-up"
              style={{ animationDelay: "1000ms", animationFillMode: "forwards" }}
            >
              <p className="text-[10px] text-primary font-semibold uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                Central de Demandas
              </p>
              <p className="text-lg font-bold text-foreground leading-tight">
                Criar demanda inteligente
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Descreva sua solicitação — a IA estrutura o resto.
              </p>
            </div>

            {/* Textarea simulado com typewriter */}
            <div
              className="liquid-glass-highlight p-3.5 opacity-0 animate-fade-in-up relative"
              style={{
                animationDelay: "1200ms",
                animationFillMode: "forwards",
                borderRadius: "14px",
                transform: "translateZ(25px)",
                boxShadow: "0 12px 30px -10px hsl(199 89% 30% / 0.3)",
              }}
            >
              <div className="flex items-start gap-2.5">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background:
                      "linear-gradient(135deg, hsl(221 85% 53% / 0.2), hsl(173 80% 40% / 0.1))",
                    boxShadow:
                      "inset 0 1px 0 hsl(0 0% 100% / 0.2), 0 4px 12px -4px hsl(221 85% 53% / 0.4)",
                  }}
                >
                  <Send className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider mb-1">
                    Descrição da demanda
                  </p>
                  <p className="text-[11px] text-foreground leading-snug font-medium min-h-[2.5rem]">
                    {typed}
                    <span
                      className="inline-block w-[2px] h-3 ml-0.5 align-middle bg-primary animate-pulse"
                      aria-hidden="true"
                    />
                  </p>
                </div>
              </div>
            </div>

            {/* Chips interpretados */}
            <div className="flex flex-wrap gap-1.5">
              {chips.map((c) => (
                <div
                  key={c.label}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full opacity-0 animate-fade-in-up"
                  style={{
                    background: c.color.replace(")", " / 0.12)"),
                    border: `1px solid ${c.color.replace(")", " / 0.25)")}`,
                    boxShadow: `0 4px 12px -4px ${c.color.replace(")", " / 0.3)")}`,
                    animationDelay: `${c.delay}ms`,
                    animationFillMode: "forwards",
                    transform: "translateZ(18px)",
                  }}
                >
                  <c.icon className="w-2.5 h-2.5" style={{ color: c.color }} />
                  <span
                    className="text-[10px] font-semibold tabular-nums"
                    style={{ color: c.color }}
                  >
                    {c.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Mini stepper */}
            <div
              className="liquid-glass-compact p-3 opacity-0 animate-fade-in-up relative"
              style={{
                animationDelay: "2700ms",
                animationFillMode: "forwards",
                borderRadius: "14px",
                transform: "translateZ(15px)",
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider">
                  Fluxo da demanda
                </p>
                <p className="text-[9px] font-semibold text-success">2 / 2 concluído</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 flex-1">
                  <div className="w-5 h-5 rounded-full bg-success/20 flex items-center justify-center ring-1 ring-success/40">
                    <CheckCircle2 className="w-3 h-3 text-success" />
                  </div>
                  <span className="text-[10px] font-medium text-foreground">Preencher</span>
                </div>
                <div className="flex-1 h-1 rounded-full bg-muted/40 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: "100%",
                      background:
                        "linear-gradient(90deg, hsl(160 84% 39%), hsl(173 80% 40%))",
                      animation: "draw-line 1s ease-out 2.8s both",
                    }}
                  />
                </div>
                <div className="flex items-center gap-1.5 flex-1 justify-end">
                  <span className="text-[10px] font-medium text-foreground">Confirmação</span>
                  <div className="w-5 h-5 rounded-full bg-success/20 flex items-center justify-center ring-1 ring-success/40">
                    <CheckCircle2 className="w-3 h-3 text-success" />
                  </div>
                </div>
              </div>
            </div>

            {/* CTA + confirmação */}
            <div className="space-y-2.5">
              <Link
                to="/login"
                className="group/cta relative flex items-center justify-between gap-2 p-3 rounded-2xl opacity-0 animate-fade-in-up overflow-hidden transition-transform duration-300 hover:-translate-y-0.5"
                style={{
                  animationDelay: "3000ms",
                  animationFillMode: "forwards",
                  transform: "translateZ(30px)",
                  background:
                    "linear-gradient(135deg, hsl(221 85% 53%), hsl(199 89% 48%))",
                  boxShadow:
                    "0 14px 32px -10px hsl(221 85% 40% / 0.55), inset 0 1px 0 hsl(0 0% 100% / 0.25)",
                }}
              >
                <span className="flex items-center gap-2 relative z-10">
                  <Sparkles className="w-3.5 h-3.5 text-primary-foreground" />
                  <span className="text-[12px] font-semibold text-primary-foreground">
                    Abrir minha demanda em segundos
                  </span>
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-primary-foreground transition-transform duration-300 group-hover/cta:translate-x-1 relative z-10" />
                <div
                  className="absolute inset-0 opacity-0 group-hover/cta:opacity-100 transition-opacity duration-500"
                  style={{
                    background:
                      "linear-gradient(115deg, transparent 30%, hsl(0 0% 100% / 0.18) 50%, transparent 70%)",
                  }}
                />
              </Link>

              <div
                className="liquid-glass-compact flex items-center gap-2.5 p-2.5 opacity-0 animate-fade-in-up relative"
                style={{
                  animationDelay: "3200ms",
                  animationFillMode: "forwards",
                  borderRadius: "12px",
                  transform: "translateZ(20px)",
                  boxShadow: "0 8px 22px -10px hsl(160 84% 30% / 0.35)",
                }}
              >
                <div className="w-6 h-6 rounded-lg bg-success/15 flex items-center justify-center">
                  <CheckCircle2 className="w-3 h-3 text-success" />
                </div>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  <span className="font-semibold text-foreground">Solicitação recebida</span>{" "}
                  · enviada ao time CW Finanças
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
