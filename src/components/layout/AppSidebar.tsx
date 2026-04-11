import { 
  Home,
  LayoutDashboard, 
  TrendingUp, 
  TrendingDown, 
  ArrowLeftRight,
  BarChart3,
  FileText,
  Upload, 
  Settings,
  Sparkles,
  LineChart,
  FileSpreadsheet,
  ClipboardList,
  Building2,
  CreditCard,
  FileDown
} from "lucide-react";
import logoIcon from "@/assets/logo-icon.png";
import logoFull from "@/assets/logo-full.png";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const mainNavItems = [
  { title: "Home", url: "/dashboard", icon: Home },
  { title: "Dashboard", url: "/overview", icon: LayoutDashboard },
  { title: "Minha Empresa", url: "/company", icon: Building2 },
  { title: "Receitas", url: "/income", icon: TrendingUp },
  { title: "Despesas", url: "/expenses", icon: TrendingDown },
  { title: "Fluxo de Caixa", url: "/cash-flow", icon: ArrowLeftRight },
  { title: "DRE", url: "/dre", icon: BarChart3 },
  { title: "Contas a Pagar/Receber", url: "/accounts", icon: ClipboardList },
  { title: "Cartão de Crédito", url: "/credit-cards", icon: CreditCard },
  { title: "Previsões", url: "/forecasts", icon: LineChart },
];

const toolsNavItems = [
  { title: "Notas Fiscais", url: "/invoices", icon: FileText },
  { title: "Google Sheets", url: "/google-sheets", icon: FileSpreadsheet },
  { title: "Upload de Dados", url: "/upload", icon: Upload },
  { title: "Insights IA", url: "/insights", icon: Sparkles },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (path: string) => {
    if (path === "/") return currentPath === "/";
    return currentPath.startsWith(path);
  };

  const renderNavItem = (item: typeof mainNavItems[0]) => (
    <SidebarMenuItem key={item.title}>
      <SidebarMenuButton 
        asChild
        isActive={isActive(item.url)}
        tooltip={item.title}
      >
        <NavLink 
          to={item.url} 
          end={item.url === "/"}
          className={`
            flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative
            text-foreground/70 hover:text-foreground
            ${isActive(item.url) 
              ? 'sidebar-nav-active text-primary font-medium' 
              : 'sidebar-nav-hover border border-transparent'}
          `}
          activeClassName="sidebar-nav-active text-primary font-medium"
        >
          {isActive(item.url) && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full shadow-[0_0_8px_rgba(45,126,243,0.4)]" />
          )}
          <item.icon className={`w-[18px] h-[18px] shrink-0 transition-colors ${isActive(item.url) ? 'text-primary' : ''}`} />
          {!collapsed && <span className="text-[13px]">{item.title}</span>}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar 
      className="sidebar-glass-refined"
      collapsible="icon"
    >
      {/* Header with Logo */}
      <SidebarHeader className={`border-b border-black/[0.04] ${collapsed ? 'p-2' : 'px-3 py-3 md:py-4'}`}>
        <div className="flex items-center justify-center">
          <img 
            src={collapsed ? logoIcon : logoFull} 
            alt="CW Finanças" 
            className={`object-contain transition-all duration-300 ${collapsed ? 'w-9 h-9' : 'h-[120px] md:h-[156px] w-auto'}`}
            style={{ filter: 'drop-shadow(0 2px 6px rgba(15, 23, 42, 0.08))' }}
          />
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-5">
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] font-semibold text-foreground/40 uppercase tracking-wider px-3 mb-3">
            Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {mainNavItems.map(renderNavItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Tools Navigation */}
        <SidebarGroup className="mt-6">
          <SidebarGroupLabel className="text-[11px] font-semibold text-foreground/40 uppercase tracking-wider px-3 mb-3">
            Ferramentas
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {toolsNavItems.map(renderNavItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="p-3 border-t border-black/[0.04]">
        <SidebarMenu>
          {renderNavItem({ title: "Configurações", url: "/settings", icon: Settings })}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
