import { 
  Home,
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
import logoIcon from "@/assets/logo-icon.png";
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
  { title: "Home", url: "/", icon: Home },
  { title: "Dashboard", url: "/overview", icon: LayoutDashboard },
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
      className="sidebar-glass"
      collapsible="icon"
    >
      {/* Header with Logo */}
      <SidebarHeader className="p-4 border-b border-white/[0.06]">
        <div className={`flex items-center justify-center ${collapsed ? 'p-1' : 'p-3'}`}>
          <div className={`sidebar-logo-glass ${collapsed ? 'p-1.5' : 'p-4 w-full'} flex items-center justify-center`}>
            <img 
              src={logoIcon} 
              alt="CW Finanças" 
              className={`object-contain transition-all duration-300 ${collapsed ? 'w-8 h-8' : 'w-full max-w-[160px] h-auto'}`}
              style={{ filter: 'drop-shadow(0 0 12px rgba(45, 126, 243, 0.25))' }}
            />
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-5">
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] font-semibold text-white/35 uppercase tracking-wider px-3 mb-3">
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
                        text-white/65 hover:text-white/90 hover:bg-white/[0.06]
                        ${isActive(item.url) ? 'bg-blue-500/10 text-blue-400 font-medium' : ''}
                      `}
                      activeClassName="bg-blue-500/10 text-blue-400 font-medium"
                    >
                      {isActive(item.url) && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-blue-400 rounded-r-full shadow-[0_0_8px_rgba(96,165,250,0.5)]" />
                      )}
                      <item.icon className={`w-5 h-5 shrink-0 transition-colors ${isActive(item.url) ? 'text-blue-400' : ''}`} />
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
          <SidebarGroupLabel className="text-[11px] font-semibold text-white/35 uppercase tracking-wider px-3 mb-3">
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
                        text-white/65 hover:text-white/90 hover:bg-white/[0.06]
                        ${isActive(item.url) ? 'bg-blue-500/10 text-blue-400 font-medium' : ''}
                      `}
                      activeClassName="bg-blue-500/10 text-blue-400 font-medium"
                    >
                      {isActive(item.url) && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-blue-400 rounded-r-full shadow-[0_0_8px_rgba(96,165,250,0.5)]" />
                      )}
                      <item.icon className={`w-5 h-5 shrink-0 transition-colors ${isActive(item.url) ? 'text-blue-400' : ''}`} />
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
      <SidebarFooter className="p-3 border-t border-white/[0.06]">
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
                  text-white/65 hover:text-white/90 hover:bg-white/[0.06]
                  ${isActive("/settings") ? 'bg-blue-500/10 text-blue-400 font-medium' : ''}
                `}
                activeClassName="bg-blue-500/10 text-blue-400 font-medium"
              >
                {isActive("/settings") && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-blue-400 rounded-r-full shadow-[0_0_8px_rgba(96,165,250,0.5)]" />
                )}
                <Settings className={`w-5 h-5 shrink-0 transition-colors ${isActive("/settings") ? 'text-blue-400' : ''}`} />
                {!collapsed && <span className="text-sm">Configurações</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
