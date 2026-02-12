import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  FileText,
  FileSpreadsheet,
  Sparkles,
  BarChart3,
  Settings,
} from "lucide-react";

const links = [
  { label: "Visão Geral", icon: LayoutDashboard, href: "/overview" },
  { label: "Receitas", icon: TrendingUp, href: "/income" },
  { label: "Despesas", icon: TrendingDown, href: "/expenses" },
  { label: "Fluxo de Caixa", icon: ArrowLeftRight, href: "/cash-flow" },
  { label: "Notas Fiscais", icon: FileText, href: "/invoices" },
  { label: "Google Sheets", icon: FileSpreadsheet, href: "/google-sheets" },
  { label: "Insights IA", icon: Sparkles, href: "/insights" },
  { label: "Relatórios", icon: BarChart3, href: "/balance" },
  { label: "Configurações", icon: Settings, href: "/settings" },
];

interface QuickLinksProps {
  delay?: number;
}

export function QuickLinks({ delay = 0 }: QuickLinksProps) {
  const navigate = useNavigate();

  return (
    <div
      className="opacity-0 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}
    >
      <div className="liquid-glass-compact p-5 md:p-6">
        <h3 className="text-foreground/90 font-semibold text-sm mb-4">Atalhos</h3>
        <div className="grid grid-cols-3 gap-2">
          {links.map(link => (
            <button
              key={link.href}
              onClick={() => navigate(link.href)}
              className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl hover:bg-primary/5 transition-all group"
            >
              <div className="w-9 h-9 rounded-xl bg-foreground/[0.04] flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                <link.icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <span className="text-muted-foreground/70 group-hover:text-foreground text-[10px] font-medium text-center leading-tight transition-colors">
                {link.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
