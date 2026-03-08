import { Search, Bell, Download, Menu, LogOut, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { GlobalDateRangeFilter } from "./GlobalDateRangeFilter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export function DashboardHeader() {
  const { user, signOut } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();

  const displayName = profile?.full_name || user?.user_metadata?.full_name || "Usuário";
  const displayEmail = user?.email || "";
  const initials = getInitials(displayName);

  return (
    <header className="h-16 dashboard-header-glass sticky top-0 z-40">
      <div className="h-full px-4 md:px-6 flex items-center justify-between gap-4">
        {/* Left side - Menu and Search */}
        <div className="flex items-center gap-4 flex-1">
          <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-corporate">
            <Menu className="w-5 h-5" />
          </SidebarTrigger>
          
          <div className="relative max-w-xs flex-1 hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              type="search"
              placeholder="Buscar transações..."
              className="pl-10 bg-white/50 backdrop-blur-sm border-white/40 focus:border-primary/30 focus:ring-2 focus:ring-primary/15 transition-corporate rounded-xl h-9 text-sm shadow-sm"
            />
          </div>
        </div>

        {/* Right side - Actions */}
        <div className="flex items-center gap-2">
          <GlobalDateRangeFilter />
          
          {/* Export Button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="hidden sm:flex gap-2 rounded-xl border-white/40 bg-white/50 backdrop-blur-sm hover:bg-white/70 hover:border-white/60 h-9 px-3 text-sm shadow-sm transition-corporate"
              >
                <Download className="w-4 h-4" />
                <span>Exportar</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-xl liquid-glass-tooltip border-none">
              <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Exportar Dados
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer text-sm rounded-lg">Exportar como PDF</DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer text-sm rounded-lg">Exportar como CSV</DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer text-sm rounded-lg">Exportar como Excel</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative rounded-xl hover:bg-white/50 h-9 w-9 transition-corporate">
            <Bell className="w-5 h-5 text-muted-foreground" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full shadow-glow-primary" />
          </Button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full h-9 w-9">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-sm ring-2 ring-white/60">
                  <span className="text-xs font-semibold text-primary-foreground">{initials}</span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl liquid-glass-tooltip border-none">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="font-semibold text-sm">{displayName}</span>
                  <span className="text-xs font-normal text-muted-foreground">{displayEmail}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer text-sm gap-2 rounded-lg" onClick={() => navigate("/settings")}>
                <Settings className="w-4 h-4" />
                Configurações
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive cursor-pointer text-sm gap-2 rounded-lg" onClick={() => signOut()}>
                <LogOut className="w-4 h-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
