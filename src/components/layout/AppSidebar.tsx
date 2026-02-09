import { 
  LayoutDashboard, 
  TrendingUp, 
  TrendingDown, 
  ArrowLeftRight,
  Scale,
  FileText,
  Upload, 
  Settings,
  Sparkles,
  LineChart,
  FileSpreadsheet
} from "lucide-react";
import logoImg from "@/assets/logo.png";
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
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Receitas", url: "/income", icon: TrendingUp },
  { title: "Despesas", url: "/expenses", icon: TrendingDown },
  { title: "Fluxo de Caixa", url: "/cash-flow", icon: ArrowLeftRight },
  { title: "Balanço Patrimonial", url: "/balance", icon: Scale },
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

  return (
    <Sidebar 
      className="border-r border-border bg-sidebar"
      collapsible="icon"
    >
      {/* Header with Logo */}
      <SidebarHeader className="p-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img 
              src={logoImg} 
              alt="CW Finanças" 
              className="w-10 h-10 rounded-xl object-contain shadow-corporate-md"
            />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-foreground tracking-tight text-lg">CW Finanças</span>
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Controle PJ</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-5">
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-3">
            Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {mainNavItems.map((item) => (
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
                        flex items-center gap-3 px-3 py-2.5 rounded-lg transition-corporate relative
                        text-muted-foreground hover:text-foreground hover:bg-accent
                        ${isActive(item.url) ? 'bg-accent text-primary font-medium' : ''}
                      `}
                      activeClassName="bg-accent text-primary font-medium"
                    >
                      {isActive(item.url) && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-primary rounded-r-full" />
                      )}
                      <item.icon className={`w-5 h-5 shrink-0 transition-colors ${isActive(item.url) ? 'text-primary' : ''}`} />
                      {!collapsed && <span className="text-sm">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Tools Navigation */}
        <SidebarGroup className="mt-6">
          <SidebarGroupLabel className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-3">
            Ferramentas
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {toolsNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <NavLink 
                      to={item.url} 
                      className={`
                        flex items-center gap-3 px-3 py-2.5 rounded-lg transition-corporate relative
                        text-muted-foreground hover:text-foreground hover:bg-accent
                        ${isActive(item.url) ? 'bg-accent text-primary font-medium' : ''}
                      `}
                      activeClassName="bg-accent text-primary font-medium"
                    >
                      {isActive(item.url) && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-primary rounded-r-full" />
                      )}
                      <item.icon className={`w-5 h-5 shrink-0 transition-colors ${isActive(item.url) ? 'text-primary' : ''}`} />
                      {!collapsed && <span className="text-sm">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="p-3 border-t border-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              asChild
              isActive={isActive("/settings")}
              tooltip="Configurações"
            >
              <NavLink 
                to="/settings" 
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg transition-corporate relative
                  text-muted-foreground hover:text-foreground hover:bg-accent
                  ${isActive("/settings") ? 'bg-accent text-primary font-medium' : ''}
                `}
                activeClassName="bg-accent text-primary font-medium"
              >
                {isActive("/settings") && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-primary rounded-r-full" />
                )}
                <Settings className={`w-5 h-5 shrink-0 transition-colors ${isActive("/settings") ? 'text-primary' : ''}`} />
                {!collapsed && <span className="text-sm">Configurações</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
