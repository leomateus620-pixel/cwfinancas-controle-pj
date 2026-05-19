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
import { useLocation } from "react-router-dom";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";

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
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { useUserRole } from "@/hooks/useUserRole";
import { usePendingApprovalsCount } from "@/hooks/usePendingApprovalsCount";
import { useHomeDashboard } from "@/hooks/useHomeDashboard";

type IconType = ComponentType<{ className?: string }>;
type AccentKey = "blue" | "emerald" | "orange" | "indigo";
type KpiKind = "pulse" | "delta" | "count" | "shimmer";

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
  accent: AccentKey;
  kpi: KpiKind;
  anchor: NavChild;
  children: NavChild[];
}

const groups: NavGroup[] = [
  {
    id: "overview",
    label: "Visão Geral",
    accent: "blue",
    kpi: "pulse",
    anchor: { title: "Home", url: "/dashboard", icon: Home },
    children: [
      { title: "Dashboard executivo", url: "/overview", icon: LayoutDashboard },
      { title: "Minha Empresa", url: "/company", icon: Building2 },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    accent: "emerald",
    kpi: "delta",
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
    accent: "orange",
    kpi: "count",
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
    accent: "indigo",
    kpi: "shimmer",
    anchor: { title: "Insights IA", url: "/insights", icon: Sparkles },
    children: [
      { title: "Google Sheets", url: "/google-sheets", icon: FileSpreadsheet },
      { title: "Upload de Dados", url: "/upload", icon: Upload },
      { title: "Notas Fiscais", url: "/invoices", icon: FileText },
      { title: "Conversor de Extratos", url: "/statement-converter", icon: FileDown },
    ],
  },
];

// ─────────────────────────────────────────────
// Accent token map (kept tight, Tailwind JIT-friendly)
// ─────────────────────────────────────────────
const ACCENT = {
  blue: {
    activeBg: "bg-blue-500/[0.08]",
    activeBorder: "border-blue-400/40",
    activeShadow: "shadow-[0_8px_28px_-8px_rgba(59,130,246,0.35)]",
    hoverBorder: "group-hover:border-blue-300/60",
    hoverShadow: "group-hover:shadow-[0_18px_38px_-12px_rgba(59,130,246,0.28)]",
    iconBoxActive: "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-[0_4px_14px_rgba(59,130,246,0.45)]",
    iconBoxIdle: "bg-blue-50 text-blue-600",
    label: "text-blue-900",
  },
  emerald: {
    activeBg: "bg-emerald-500/[0.08]",
    activeBorder: "border-emerald-400/40",
    activeShadow: "shadow-[0_8px_28px_-8px_rgba(16,185,129,0.35)]",
    hoverBorder: "group-hover:border-emerald-300/50",
    hoverShadow: "group-hover:shadow-[0_18px_38px_-12px_rgba(16,185,129,0.22)]",
    iconBoxActive: "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-[0_4px_14px_rgba(16,185,129,0.45)]",
    iconBoxIdle: "bg-emerald-50 text-emerald-600",
    label: "text-emerald-900",
  },
  orange: {
    activeBg: "bg-orange-500/[0.08]",
    activeBorder: "border-orange-400/40",
    activeShadow: "shadow-[0_8px_28px_-8px_rgba(249,115,22,0.35)]",
    hoverBorder: "group-hover:border-orange-300/50",
    hoverShadow: "group-hover:shadow-[0_18px_38px_-12px_rgba(249,115,22,0.22)]",
    iconBoxActive: "bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-[0_4px_14px_rgba(249,115,22,0.45)]",
    iconBoxIdle: "bg-orange-50 text-orange-600",
    label: "text-orange-900",
  },
  indigo: {
    activeBg: "bg-indigo-500/[0.08]",
    activeBorder: "border-indigo-400/40",
    activeShadow: "shadow-[0_8px_28px_-8px_rgba(99,102,241,0.35)]",
    hoverBorder: "group-hover:border-indigo-300/50",
    hoverShadow: "group-hover:shadow-[0_18px_38px_-12px_rgba(99,102,241,0.22)]",
    iconBoxActive: "bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow-[0_4px_14px_rgba(99,102,241,0.45)]",
    iconBoxIdle: "bg-indigo-50 text-indigo-600",
    label: "text-indigo-900",
  },
} as const;

// ─────────────────────────────────────────────
// KPI slot renderer
// ─────────────────────────────────────────────
interface KpiContext {
  pendingCount: number;
  variationPercent: number | null;
  isLoading: boolean;
}

function renderKpi(kind: KpiKind, accent: AccentKey, ctx: KpiContext, active: boolean): ReactNode {
  if (kind === "pulse") {
    return (
      <span className="relative inline-flex h-2 w-2 shrink-0">
        <span className={`absolute inline-flex h-full w-full rounded-full ${active ? "bg-blue-500" : "bg-blue-400"} opacity-60 animate-ping`} />
        <span className={`relative inline-flex h-2 w-2 rounded-full ${active ? "bg-blue-500" : "bg-blue-400"}`} />
      </span>
    );
  }
  if (kind === "delta") {
    if (ctx.isLoading || ctx.variationPercent == null) {
      return <span className="text-[9.5px] font-medium text-foreground/30 font-mono">—</span>;
    }
    const positive = ctx.variationPercent >= 0;
    const sign = positive ? "+" : "";
    return (
      <span
        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md font-mono leading-none ${
          positive
            ? "bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20"
            : "bg-rose-500/10 text-rose-600 ring-1 ring-rose-500/20"
        }`}
      >
        {sign}
        {ctx.variationPercent.toFixed(1)}%
      </span>
    );
  }
  if (kind === "count") {
    if (ctx.pendingCount <= 0) return null;
    return (
      <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-[10px] font-bold text-white font-mono leading-none shadow-[0_2px_8px_rgba(249,115,22,0.4)]">
        {ctx.pendingCount > 99 ? "99+" : ctx.pendingCount}
      </span>
    );
  }
  if (kind === "shimmer") {
    return (
      <span className="relative inline-flex h-4 w-9 overflow-hidden rounded-full bg-indigo-100/60 ring-1 ring-indigo-200/50">
        <span
          className="absolute inset-y-0 -left-full w-full bg-gradient-to-r from-transparent via-indigo-400/70 to-transparent animate-shimmer"
          style={{ animationDuration: "2.2s" }}
        />
      </span>
    );
  }
  return null;
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const currentPath = location.pathname;
  const { isManager } = useUserRole();
  const { data: pendingCount = 0 } = usePendingApprovalsCount(isManager);
  const { variationPercent, isLoading: homeLoading } = useHomeDashboard();

  const kpiCtx: KpiContext = {
    pendingCount,
    variationPercent: variationPercent ?? null,
    isLoading: homeLoading,
  };

  const isActive = (path: string) => {
    if (path === "/") return currentPath === "/";
    return currentPath === path || currentPath.startsWith(path + "/");
  };

  const visibleChildren = (g: NavGroup) =>
    g.children.filter((c) => !c.internalOnly || isManager);

  const groupContainsActive = (g: NavGroup) =>
    isActive(g.anchor.url) || visibleChildren(g).some((c) => isActive(c.url));

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map((g) => [g.id, groupContainsActive(g)])),
  );

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

  // ─────────────────────────────────────────────
  // Anchor card with 3D tilt + Liquid Glass physics
  // ─────────────────────────────────────────────
  const renderAnchor = (group: NavGroup) => {
    const active = isActive(group.anchor.url);
    const open = openGroups[group.id] ?? false;
    const Icon = group.anchor.icon;
    const hasChildren = visibleChildren(group).length > 0;
    const a = ACCENT[group.accent];

    if (collapsed) {
      // Compact icon-only state — no tilt, no KPI
      return (
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={active} tooltip={group.anchor.title}>
            <NavLink
              to={group.anchor.url}
              className={`flex items-center justify-center p-2 rounded-xl transition-colors ${
                active ? `${a.activeBg} ${a.activeBorder} border` : "hover:bg-foreground/[0.04] border border-transparent"
              }`}
            >
              <Icon className={`w-[18px] h-[18px] ${active ? "text-foreground" : "text-foreground/70"}`} />
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    }

    return (
      <SidebarMenuItem className="group" style={{ transformStyle: "preserve-3d" }}>
        <div className="relative">
          {/* Active soft glow underlay */}
          {active && (
            <div
              className={`pointer-events-none absolute inset-0 rounded-2xl ${a.activeBg} ${a.activeShadow} opacity-90`}
              aria-hidden
            />
          )}

          <NavLink
            to={group.anchor.url}
            onClick={() => hasChildren && toggleGroup(group.id)}
            className={`
              relative flex items-center justify-between h-[58px] px-3.5 rounded-2xl
              backdrop-blur-xl border transition-[transform,box-shadow,background,border-color] duration-300 ease-out
              transform-gpu will-change-transform cursor-pointer
              ${active
                ? `${a.activeBorder} ${a.activeShadow} bg-white/55`
                : `border-white/55 bg-white/35 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.04)] ${a.hoverBorder} ${a.hoverShadow} group-hover:bg-white/55`
              }
              group-hover:[transform:perspective(900px)_rotateY(-5deg)_rotateX(2deg)_translateZ(6px)_scale(1.02)]
              group-active:scale-[0.97]
            `}
            style={{ transformOrigin: "center left" }}
          >
            {/* Top sheen (glass highlight) */}
            <span
              className="pointer-events-none absolute inset-x-3 top-0 h-px rounded-full bg-gradient-to-r from-transparent via-white/70 to-transparent"
              aria-hidden
            />

            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`flex items-center justify-center w-9 h-9 rounded-xl shrink-0 transition-all duration-300 ${
                  active ? a.iconBoxActive : `${a.iconBoxIdle} group-hover:scale-[1.06]`
                }`}
                style={{ transform: "translateZ(8px)" }}
              >
                <Icon className="w-[18px] h-[18px]" />
              </div>
              <span
                className={`text-[13px] font-medium truncate transition-colors ${
                  active ? `${a.label} font-semibold` : "text-foreground/75 group-hover:text-foreground"
                }`}
                style={{ transform: "translateZ(4px)" }}
              >
                {group.anchor.title}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0" style={{ transform: "translateZ(6px)" }}>
              {renderKpi(group.kpi, group.accent, kpiCtx, active)}
              {hasChildren && (
                <ChevronRight
                  className={`w-4 h-4 text-foreground/35 transition-transform duration-300 ${open ? "rotate-90" : ""}`}
                />
              )}
            </div>
          </NavLink>
        </div>
      </SidebarMenuItem>
    );
  };

  // Sub-items stay discrete (no tilt) to preserve hierarchy
  const renderSubItem = (child: NavChild) => {
    const active = isActive(child.url);
    const Icon = child.icon;
    const showBadge = child.badgeKey === "pending" && pendingCount > 0;
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
            {showBadge && (
              <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-orange-500/15 text-orange-600 text-[10px] font-bold font-mono">
                {pendingCount > 99 ? "99+" : pendingCount}
              </span>
            )}
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
          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
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
          <SidebarGroupLabel className="text-[10px] font-bold tracking-[0.15em] text-foreground/40 uppercase px-3 mb-3 font-mono">
            Navegação
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-2.5" style={{ perspective: "1100px" }}>
              {groups.map(renderGroup)}
            </SidebarMenu>
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
