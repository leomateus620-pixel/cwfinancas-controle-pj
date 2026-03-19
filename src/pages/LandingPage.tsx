import { useEffect } from "react";
import { Link } from "react-router-dom";
import { LogIn, UserPlus, BarChart3, TrendingUp, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoFull from "@/assets/logo-full.png";

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
      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-lg text-center space-y-8">
          {/* Logo */}
          <img
            src={logoFull}
            alt="CW Finanças"
            className="w-[220px] h-[220px] mx-auto object-contain"
          />

          {/* Description */}
          <div className="space-y-3">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
              Gestão Financeira para PJ
            </h1>
            <p className="text-muted-foreground leading-relaxed max-w-md mx-auto">
              Controle receitas, despesas, fluxo de caixa, DRE e contas a pagar/receber da sua empresa em um só lugar. Integre com Google Sheets e obtenha insights com inteligência artificial.
            </p>
          </div>

          {/* Features */}
          <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
            {[
              { icon: BarChart3, label: "DRE e Fluxo de Caixa" },
              { icon: TrendingUp, label: "Previsões com IA" },
              { icon: Shield, label: "Dados protegidos" },
            ].map((f) => (
              <div key={f.label} className="flex flex-col items-center gap-1.5 text-center">
                <f.icon className="w-5 h-5 text-primary" />
                <span className="text-xs text-muted-foreground">{f.label}</span>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              asChild
              className="w-full sm:w-auto gap-2 h-11 rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/20 text-primary-foreground font-medium"
            >
              <Link to="/login">
                <LogIn className="w-4 h-4" />
                Entrar
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="w-full sm:w-auto gap-2 h-11 rounded-xl"
            >
              <Link to="/register">
                <UserPlus className="w-4 h-4" />
                Criar conta
              </Link>
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center space-y-2">
        <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
          <Link to="/politica-de-privacidade" className="hover:text-primary hover:underline">
            Política de Privacidade
          </Link>
          <span>•</span>
          <Link to="/termos-de-uso" className="hover:text-primary hover:underline">
            Termos de Uso
          </Link>
        </div>
        <p className="text-xs text-muted-foreground/60">
          © {new Date().getFullYear()} CW Finanças. Todos os direitos reservados.
        </p>
      </footer>
    </div>
  );
}
