import { Search, Bell, Download, User, Menu } from "lucide-react";
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

export function DashboardHeader() {
  return (
    <header className="h-16 border-b border-border bg-card/95 backdrop-blur-md sticky top-0 z-40 shadow-corporate-sm">
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
              className="pl-10 bg-background border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-corporate rounded-lg h-9 text-sm"
            />
          </div>
        </div>

        {/* Right side - Actions */}
        <div className="flex items-center gap-2">
          {/* Global Date Range Filter */}
          <GlobalDateRangeFilter />
          
          {/* Export Button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="hidden sm:flex gap-2 rounded-lg border-border hover:bg-accent hover:text-accent-foreground h-9 px-3 text-sm"
              >
                <Download className="w-4 h-4" />
                <span>Exportar</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-lg">
              <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Exportar Dados
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer text-sm">Exportar como PDF</DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer text-sm">Exportar como CSV</DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer text-sm">Exportar como Excel</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative rounded-lg hover:bg-accent h-9 w-9">
            <Bell className="w-5 h-5 text-muted-foreground" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full" />
          </Button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full h-9 w-9">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-corporate-sm">
                  <User className="w-4 h-4 text-primary-foreground" />
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-lg">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="font-semibold text-sm">João Silva</span>
                  <span className="text-xs font-normal text-muted-foreground">joao@empresa.com</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer text-sm">Perfil</DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer text-sm">Configurações da Equipe</DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer text-sm">Faturamento</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive cursor-pointer text-sm">Sair</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
