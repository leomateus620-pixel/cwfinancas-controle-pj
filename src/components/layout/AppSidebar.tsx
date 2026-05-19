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
  FileDown,
  Inbox,
  PlusCircle,
  CheckSquare,
  FolderOpen,
  Sliders,
  LayoutGrid,
  ChevronRight,
} from "lucide-react";
import logoIcon from "@/assets/logo-icon.png";
import logoFull from "@/assets/logo-full.png";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState, type ComponentType } from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useUserRole } from "@/hooks/useUserRole";
import { usePendingApprovalsCount } from "@/hooks/usePendingApprovalsCount";

type IconType = ComponentType<{ className?: string }>;

interface NavChild {
  title: string;
  url: string;
  icon: IconType;
  badgeKey?: "pending";
  internalOnly?: boolean;
}

interface NavGroup {
  id: string;
  label: string;
  anchor: NavChild;
  children: NavChild[];
}

const groups: NavGroup[] = [
  {
    id: "overview",
    label: "Visão Geral",
    anchor: { title: "Home", url: "/dashboard", icon: Home },
    children: [
      { title: "Dashboard executivo", url: "/overview", icon: LayoutDashboard },
      { title: "Minha Empresa", url: "/company", icon: Building2 },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    anchor: { title: "Fluxo de Caixa", url: "/cash-flow", icon: ArrowLeftRight },
    children: [
      { title: "Receitas", url: "/income", icon: TrendingUp },
      { title: "Despesas", url: "/expenses", icon: TrendingDown },
      { title: "DRE", url: "/dre", icon: BarChart3 },
      { title: "Contas a Pagar/Receber", url: "/accounts", icon: ClipboardList },
      { title: "Cartão de Crédito", url: "/credit-cards", icon: CreditCard },
      { title: "Previsões", url: "/forecasts", icon: LineChart },
    ],
  },
  {
    id: "demandas",
    label: "Demandas",
    anchor: { title: "Dashboard de Demandas", url: "/demands/dashboard", icon: LayoutGrid },
    children: [
      { title: "Nova Demanda", url: "/demands/new", icon: PlusCircle },
      { title: "Recebidas", url: "/demands", icon: Inbox },
      { title: "Aprovações Pendentes", url: "/demands/approvals", icon: CheckSquare, badgeKey: "pending", internalOnly: true },
      { title: "Documentos", url: "/demands/documents", icon: FolderOpen, internalOnly: true },
      { title: "Configurações da Central", url: "/demands/settings", icon: Sliders, internalOnly: true },
    ],
  },
  {
    id: "ferramentas",
    label: "Ferramentas",
    anchor: { title: "Insights IA", url: "/insights", icon: Sparkles },
    children: [
      { title: "Google Sheets", url: "/google-sheets", icon: FileSpreadsheet },
      { title: "Upload de Dados", url: "/upload", icon: Upload },
      { title: "Notas Fiscais", url: "/invoices", icon: FileText },
      { title: "Conversor de Extratos", url: "/statement-converter", icon: FileDown },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const { isManager } = useUserRole();
  const { data: pendingCount = 0 } = usePendingApprovalsCount(isManager);

  const isActive = (path: string) => {
    if (path === "/") return currentPath === "/";
    // exact match for anchors that are prefixes of children
    return currentPath === path || currentPath.startsWith(path + "/");
  };

  const visibleChildren = (g: NavGroup) =>
    g.children.filter((c) => !c.internalOnly || isManager);

  const groupContainsActive = (g: NavGroup) =>
    isActive(g.anchor.url) || visibleChildren(g).some((c) => isActive(c.url));

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map((g) => [g.id, groupContainsActive(g)])),
  );

  // Auto-open the group containing the current route when navigation happens
  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const g of groups) {
        if (groupContainsActive(g)) next[g.id] = true;
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath, isManager]);

  const toggleGroup = (id: string) =>
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));

  const renderBadge = (child: NavChild) => {
    if (child.badgeKey === "pending" && pendingCount > 0) {
      return (
        <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-violet-100 text-violet-700 text-[10px] font-semibold">
          {pendingCount}
        </span>
      );
    }
    return null;
  };

  const renderAnchor = (group: NavGroup) => {
    const active = isActive(group.anchor.url);
    const open = openGroups[group.id] ?? false;
    const Icon = group.anchor.icon;
    const hasChildren = visibleChildren(group).length > 0;

    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={active}
          tooltip={group.anchor.title}
          onClick={(e) => {
            // When collapsed (icon-only), just navigate; submenu is hidden anyway.
            if (collapsed) return;
            // Toggle group; navigation is handled by NavLink inside.
            if (hasChildren) toggleGroup(group.id);
          }}
        >
          <NavLink
            to={group.anchor.url}
            className={`
              flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative
              text-foreground/70 hover:text-foreground
              ${active ? "sidebar-nav-active text-primary font-medium" : "sidebar-nav-hover border border-transparent"}
            `}
            activeClassName="sidebar-nav-active text-primary font-medium"
          >
            {active && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full shadow-[0_0_8px_rgba(45,126,243,0.4)]" />
            )}
            <Icon className={`w-[18px] h-[18px] shrink-0 transition-colors ${active ? "text-primary" : ""}`} />
            {!collapsed && <span className="text-[13px] flex-1">{group.anchor.title}</span>}
            {!collapsed && hasChildren && (
              <ChevronRight
                className={`w-4 h-4 shrink-0 text-foreground/40 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
              />
            )}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  const renderSubItem = (child: NavChild) => {
    const active = isActive(child.url);
    const Icon = child.icon;
    return (
      <SidebarMenuSubItem key={child.title}>
        <SidebarMenuSubButton asChild isActive={active}>
          <NavLink
            to={child.url}
            className={`
              flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 relative
              text-foreground/65 hover:text-foreground text-[12.5px]
              ${active ? "sidebar-nav-active text-primary font-medium" : "hover:bg-foreground/[0.03]"}
            `}
            activeClassName="sidebar-nav-active text-primary font-medium"
          >
            {active && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-primary rounded-r-full" />
            )}
            <Icon className={`w-[15px] h-[15px] shrink-0 ${active ? "text-primary" : ""}`} />
            <span className="flex-1 truncate">{child.title}</span>
            {renderBadge(child)}
          </NavLink>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    );
  };

  const renderGroup = (group: NavGroup) => {
    const open = openGroups[group.id] ?? false;
    const children = visibleChildren(group);
    return (
      <Collapsible key={group.id} open={collapsed ? false : open} className="space-y-1">
        {renderAnchor(group)}
        {!collapsed && children.length > 0 && (
          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
            <SidebarMenuSub className="mt-1 mb-1">
              {children.map(renderSubItem)}
            </SidebarMenuSub>
          </CollapsibleContent>
        )}
      </Collapsible>
    );
  };

  return (
    <Sidebar className="sidebar-glass-refined" collapsible="icon">
      <SidebarHeader className={`border-b border-black/[0.04] ${collapsed ? "p-2" : "px-3 py-3 md:py-4"}`}>
        <div className="flex items-center justify-center">
          <img
            src={collapsed ? logoIcon : logoFull}
            alt="CW Finanças"
            className={`object-contain transition-all duration-300 ${collapsed ? "w-9 h-9" : "h-[120px] md:h-[156px] w-auto"}`}
            style={{ filter: "drop-shadow(0 2px 6px rgba(15, 23, 42, 0.08))" }}
          />
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-5">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] font-semibold text-foreground/40 uppercase tracking-wider px-3 mb-3">
            Navegação
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-2">{groups.map(renderGroup)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-black/[0.04]">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive("/settings")} tooltip="Configurações">
              <NavLink
                to="/settings"
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative
                  text-foreground/70 hover:text-foreground
                  ${isActive("/settings") ? "sidebar-nav-active text-primary font-medium" : "sidebar-nav-hover border border-transparent"}
                `}
                activeClassName="sidebar-nav-active text-primary font-medium"
              >
                <Settings className={`w-[18px] h-[18px] shrink-0 ${isActive("/settings") ? "text-primary" : ""}`} />
                {!collapsed && <span className="text-[13px] flex-1">Configurações</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
