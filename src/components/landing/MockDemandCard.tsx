import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  DollarSign,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Send,
  CalendarClock,
  Tag,
  AlertCircle,
} from "lucide-react";
import logoFull from "@/assets/logo-full.png";

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
        {/* Diagonal glare — sutil para não lavar texto */}
        <div
          className="absolute inset-0 pointer-events-none z-20 opacity-25"
          style={{
            background:
              "linear-gradient(115deg, transparent 35%, hsl(0 0% 100% / 0.06) 48%, hsl(0 0% 100% / 0.10) 50%, hsl(0 0% 100% / 0.06) 52%, transparent 65%)",
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
            <div className="px-4 py-1 rounded-lg bg-muted/50 text-[10px] text-foreground/70 font-semibold tracking-wide">
              cwfinancas.app/demandas
            </div>
          </div>
        </div>

        {/* Body — sem sidebar, foco total no objetivo */}
        <div
          className="min-h-[440px] relative z-10 p-6 space-y-5"
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Header */}
          <div
            className="flex items-start justify-between gap-4 opacity-0 animate-fade-in-up"
            style={{ animationDelay: "900ms", animationFillMode: "forwards" }}
          >
            <div className="min-w-0">
              <p className="text-[11px] text-primary font-bold uppercase tracking-[0.18em] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Central de Demandas
              </p>
              <h3 className="text-2xl font-bold tracking-tight text-foreground leading-tight mt-1">
                Criar demanda inteligente
              </h3>
              <p className="text-[12px] text-foreground/70 font-medium mt-1">
                Descreva sua solicitação — a IA estrutura o resto.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 pt-1">
              <img src={logoFull} alt="" className="w-8 h-8 object-contain" />
              <span className="text-xs font-bold text-foreground">CW Finanças</span>
            </div>
          </div>

          {/* Textarea simulado com typewriter */}
          <div
            className="liquid-glass-highlight p-4 opacity-0 animate-fade-in-up relative"
            style={{
              animationDelay: "1150ms",
              animationFillMode: "forwards",
              borderRadius: "16px",
              transform: "translateZ(28px)",
              boxShadow: "0 16px 36px -12px hsl(199 89% 30% / 0.35)",
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(221 85% 53% / 0.22), hsl(173 80% 40% / 0.12))",
                  boxShadow:
                    "inset 0 1px 0 hsl(0 0% 100% / 0.25), 0 6px 14px -4px hsl(221 85% 53% / 0.45)",
                }}
              >
                <Send className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-foreground/60 font-bold uppercase tracking-[0.16em] mb-1.5">
                  Descrição da demanda
                </p>
                <p className="text-[13px] text-foreground leading-snug font-semibold min-h-[2.75rem]">
                  {typed}
                  <span
                    className="inline-block w-[2px] h-3.5 ml-0.5 align-middle bg-primary animate-pulse"
                    aria-hidden="true"
                  />
                </p>
              </div>
            </div>
          </div>

          {/* Chips interpretados */}
          <div className="flex flex-wrap gap-2">
            {chips.map((c) => (
              <div
                key={c.label}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full opacity-0 animate-fade-in-up"
                style={{
                  background: c.color.replace(")", " / 0.18)"),
                  border: `1px solid ${c.color.replace(")", " / 0.45)")}`,
                  boxShadow: `0 6px 14px -4px ${c.color.replace(")", " / 0.35)")}, inset 0 1px 0 hsl(0 0% 100% / 0.15)`,
                  animationDelay: `${c.delay}ms`,
                  animationFillMode: "forwards",
                  transform: "translateZ(20px)",
                }}
              >
                <c.icon className="w-3 h-3" style={{ color: c.color }} />
                <span
                  className="text-[11px] font-bold tabular-nums"
                  style={{ color: c.color }}
                >
                  {c.label}
                </span>
              </div>
            ))}
          </div>

          {/* Mini stepper */}
          <div
            className="liquid-glass-compact p-3.5 opacity-0 animate-fade-in-up relative"
            style={{
              animationDelay: "2700ms",
              animationFillMode: "forwards",
              borderRadius: "14px",
              transform: "translateZ(18px)",
            }}
          >
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[10px] text-foreground/60 font-bold uppercase tracking-[0.16em]">
                Fluxo da demanda
              </p>
              <p className="text-[10px] font-bold text-success">2 / 2 concluído</p>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1.5 flex-1">
                <div className="w-5 h-5 rounded-full bg-success/25 flex items-center justify-center ring-1 ring-success/50">
                  <CheckCircle2 className="w-3 h-3 text-success" />
                </div>
                <span className="text-[11px] font-semibold text-foreground">Preencher</span>
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
                <span className="text-[11px] font-semibold text-foreground">Confirmação</span>
                <div className="w-5 h-5 rounded-full bg-success/25 flex items-center justify-center ring-1 ring-success/50">
                  <CheckCircle2 className="w-3 h-3 text-success" />
                </div>
              </div>
            </div>
          </div>

          {/* CTA + confirmação */}
          <div className="space-y-2.5">
            <Link
              to="/login"
              className="group/cta relative flex items-center justify-between gap-2 p-3.5 rounded-2xl opacity-0 animate-fade-in-up overflow-hidden transition-transform duration-300 hover:-translate-y-0.5"
              style={{
                animationDelay: "3000ms",
                animationFillMode: "forwards",
                transform: "translateZ(34px)",
                background:
                  "linear-gradient(135deg, hsl(221 85% 53%), hsl(199 89% 48%))",
                boxShadow:
                  "0 18px 38px -10px hsl(221 85% 40% / 0.65), inset 0 1px 0 hsl(0 0% 100% / 0.3)",
              }}
            >
              <span className="flex items-center gap-2 relative z-10">
                <Sparkles className="w-4 h-4 text-white" />
                <span
                  className="text-[13px] font-bold text-white"
                  style={{ textShadow: "0 1px 2px hsl(221 85% 20% / 0.4)" }}
                >
                  Abrir minha demanda em segundos
                </span>
              </span>
              <ArrowRight className="w-4 h-4 text-white transition-transform duration-300 group-hover/cta:translate-x-1 relative z-10" />
              <div
                className="absolute inset-0 opacity-0 group-hover/cta:opacity-100 transition-opacity duration-500"
                style={{
                  background:
                    "linear-gradient(115deg, transparent 30%, hsl(0 0% 100% / 0.2) 50%, transparent 70%)",
                }}
              />
            </Link>

            <div
              className="liquid-glass-compact flex items-center gap-2.5 p-2.5 opacity-0 animate-fade-in-up relative"
              style={{
                animationDelay: "3200ms",
                animationFillMode: "forwards",
                borderRadius: "12px",
                transform: "translateZ(22px)",
                boxShadow: "0 10px 24px -10px hsl(160 84% 30% / 0.4)",
              }}
            >
              <div className="w-6 h-6 rounded-lg bg-success/20 flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5 text-success" />
              </div>
              <p className="text-[11px] text-foreground/80 leading-tight">
                <span className="font-bold text-foreground">Solicitação recebida</span>{" "}
                · enviada ao time CW Finanças
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
