import { Outlet, Link, useNavigate } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { DashboardHeader } from "./DashboardHeader";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut } from "lucide-react";

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function ClientMinimalHeader() {
  const { user, signOut } = useAuth();
  const { profile } = useProfile();
  const displayName = profile?.full_name || user?.user_metadata?.full_name || "Usuário";
  const displayEmail = user?.email || "";
  const initials = getInitials(displayName);

  return (
    <header className="h-16 dashboard-header-glass sticky top-0 z-40">
      <div className="h-full px-4 md:px-6 flex items-center justify-end gap-2">
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
            <DropdownMenuItem className="text-destructive cursor-pointer text-sm gap-2 rounded-lg" onClick={() => signOut()}>
              <LogOut className="w-4 h-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export function DashboardLayout() {
  const { isClient } = useUserRole();

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {isClient ? <ClientMinimalHeader /> : <DashboardHeader />}
          <main className="flex-1 p-5 md:p-6 overflow-auto animate-page-slide dashboard-glass-bg">
            <div className="max-w-[1440px] mx-auto">
              <Outlet />
            </div>
          </main>
          <footer className="px-6 py-3 text-center text-xs text-muted-foreground border-t border-border/30">
            <Link to="/politica-de-privacidade" className="hover:text-primary hover:underline">
              Política de Privacidade
            </Link>
            <span className="mx-2">•</span>
            <Link to="/termos-de-uso" className="hover:text-primary hover:underline">
              Termos de Uso
            </Link>
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
}
