import { Outlet, Link } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { DashboardHeader } from "./DashboardHeader";
import { SidebarProvider } from "@/components/ui/sidebar";

export function DashboardLayout() {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <DashboardHeader />
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
