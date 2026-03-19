import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  LogIn,
  UserPlus,
  BarChart3,
  TrendingUp,
  Shield,
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import logoFull from "@/assets/logo-full.png";

const features = [
  { icon: Home, label: "Home", color: "hsl(221 85% 53%)" },
  { icon: LayoutDashboard, label: "Dashboard", color: "hsl(221 85% 53%)" },
  { icon: DollarSign, label: "Receitas", color: "hsl(160 84% 39%)" },
  { icon: CreditCard, label: "Despesas", color: "hsl(0 72% 51%)" },
  { icon: ArrowRightLeft, label: "Fluxo de Caixa", color: "hsl(199 89% 48%)" },
  { icon: FileText, label: "DRE", color: "hsl(262 83% 58%)" },
  { icon: Receipt, label: "Contas a Pagar/Receber", color: "hsl(38 92% 50%)" },
  { icon: LineChart, label: "Previsões", color: "hsl(173 80% 40%)" },
];

const highlights = [
  {
    icon: BarChart3,
    title: "DRE e Fluxo de Caixa",
    description: "Relatórios financeiros completos e automatizados",
  },
  {
    icon: TrendingUp,
    title: "Previsões com IA",
    description: "Projeções inteligentes baseadas nos seus dados",
  },
  {
    icon: Shield,
    title: "Dados Protegidos",
    description: "Segurança e privacidade em primeiro lugar",
  },
];

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
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          {/* Left Column – Text & CTAs */}
          <div className="text-center lg:text-left space-y-8">
            {/* Logo */}
            <div
              className="opacity-0 animate-fade-in-up"
              style={{ animationDelay: "100ms", animationFillMode: "forwards" }}
            >
              <img
                src={logoFull}
                alt="CW Finanças"
                className="w-[160px] h-[160px] md:w-[200px] md:h-[200px] mx-auto lg:mx-0 object-contain drop-shadow-lg"
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

            {/* Feature pills */}
            <div
              className="flex flex-wrap items-center justify-center lg:justify-start gap-3 opacity-0 animate-fade-in-up"
              style={{ animationDelay: "400ms", animationFillMode: "forwards" }}
            >
              {highlights.map((h) => (
                <div
                  key={h.title}
                  className="liquid-glass-compact px-4 py-3 flex items-center gap-3 group"
                >
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <h.icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-semibold text-foreground">{h.title}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">{h.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div
              className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 opacity-0 animate-fade-in-up"
              style={{ animationDelay: "550ms", animationFillMode: "forwards" }}
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

          {/* Right Column – Mock App Preview */}
          <div
            className="relative opacity-0 animate-fade-in-up hidden lg:block"
            style={{ animationDelay: "400ms", animationFillMode: "forwards" }}
          >
            {/* Glow behind the preview */}
            <div
              className="absolute -inset-8 rounded-3xl opacity-30 blur-3xl pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse at 50% 40%, hsl(221 85% 53% / 0.2), hsl(173 80% 40% / 0.1), transparent 70%)",
              }}
            />

            {/* Mock Window */}
            <div className="liquid-glass p-0 overflow-hidden relative" style={{ borderRadius: "24px" }}>
              {/* Title bar */}
              <div className="flex items-center gap-2 px-5 py-3 border-b border-border/30">
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
              <div className="flex min-h-[400px]">
                {/* Sidebar */}
                <div className="w-52 border-r border-border/20 py-4 px-3 space-y-1 bg-gradient-to-b from-primary/[0.03] to-transparent">
                  <div className="flex items-center gap-2 px-2 mb-4">
                    <img src={logoFull} alt="" className="w-7 h-7 object-contain" />
                    <span className="text-xs font-bold text-foreground">CW Finanças</span>
                  </div>

                  {features.map((f, i) => (
                    <div
                      key={f.label}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all duration-300 opacity-0 animate-slide-up-fade group hover:bg-primary/5"
                      style={{
                        animationDelay: `${700 + i * 80}ms`,
                        animationFillMode: "forwards",
                      }}
                    >
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110"
                        style={{ background: `${f.color.replace(")", " / 0.1)")}` }}
                      >
                        <f.icon className="w-3.5 h-3.5" style={{ color: f.color }} />
                      </div>
                      <span className="text-muted-foreground font-medium group-hover:text-foreground transition-colors">
                        {f.label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Content area */}
                <div className="flex-1 p-5 space-y-4 overflow-hidden">
                  {/* Header */}
                  <div
                    className="opacity-0 animate-fade-in-up"
                    style={{ animationDelay: "900ms", animationFillMode: "forwards" }}
                  >
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">
                      Painel Financeiro
                    </p>
                    <p className="text-lg font-bold text-foreground">Bem-vindo 👋</p>
                  </div>

                  {/* Mini KPI cards */}
                  <div className="grid grid-cols-3 gap-2.5">
                    {[
                      { label: "Receitas", value: "R$ 84.200", color: "text-success", delay: 1000 },
                      { label: "Despesas", value: "R$ 52.800", color: "text-destructive", delay: 1100 },
                      { label: "Lucro", value: "R$ 31.400", color: "text-primary", delay: 1200 },
                    ].map((kpi) => (
                      <div
                        key={kpi.label}
                        className="liquid-glass-compact p-3 opacity-0 animate-fade-in-up"
                        style={{
                          animationDelay: `${kpi.delay}ms`,
                          animationFillMode: "forwards",
                          borderRadius: "14px",
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

                  {/* Mini chart placeholder */}
                  <div
                    className="liquid-glass-compact p-4 opacity-0 animate-fade-in-up"
                    style={{
                      animationDelay: "1300ms",
                      animationFillMode: "forwards",
                      borderRadius: "14px",
                    }}
                  >
                    <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider mb-3">
                      Evolução Mensal
                    </p>
                    {/* Fake chart bars */}
                    <div className="flex items-end gap-1.5 h-20">
                      {[40, 55, 35, 65, 50, 72, 60, 80, 68, 85, 75, 90].map((h, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                          <div
                            className="w-full rounded-t-sm transition-all duration-700"
                            style={{
                              height: `${h}%`,
                              background: i >= 9
                                ? "linear-gradient(to top, hsl(221 85% 53%), hsl(221 85% 53% / 0.5))"
                                : "linear-gradient(to top, hsl(221 85% 53% / 0.3), hsl(221 85% 53% / 0.1))",
                              animationDelay: `${1400 + i * 50}ms`,
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AI Insight badge */}
                  <div
                    className="liquid-glass-highlight flex items-center gap-2.5 p-3 opacity-0 animate-fade-in-up"
                    style={{
                      animationDelay: "1600ms",
                      animationFillMode: "forwards",
                      borderRadius: "14px",
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
