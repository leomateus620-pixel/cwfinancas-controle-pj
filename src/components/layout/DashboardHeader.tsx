import { Search, Bell, Download, User, Menu } from "lucide-react";
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
    <header className="h-16 border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-40">
      <div className="h-full px-4 md:px-6 flex items-center justify-between gap-4">
        {/* Lado esquerdo - Menu e busca */}
        <div className="flex items-center gap-4 flex-1">
          <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-premium">
            <Menu className="w-5 h-5" />
          </SidebarTrigger>
          
          <div className="relative max-w-md flex-1 hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              type="search"
              placeholder="Buscar transações, relatórios..."
              className="pl-10 bg-secondary/50 border-transparent focus:border-border focus:bg-background transition-premium"
            />
          </div>
        </div>

        {/* Lado direito - Ações */}
        <div className="flex items-center gap-2">
          {/* Botão de exportar */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="hidden sm:flex gap-2">
                <Download className="w-4 h-4" />
                <span>Exportar</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Exportar Dados</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Exportar como PDF</DropdownMenuItem>
              <DropdownMenuItem>Exportar como CSV</DropdownMenuItem>
              <DropdownMenuItem>Exportar como Excel</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Notificações */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full" />
          </Button>

          {/* Menu do usuário */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center">
                  <User className="w-4 h-4 text-primary-foreground" />
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span>João Silva</span>
                  <span className="text-xs font-normal text-muted-foreground">joao@empresa.com</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Perfil</DropdownMenuItem>
              <DropdownMenuItem>Configurações da Equipe</DropdownMenuItem>
              <DropdownMenuItem>Faturamento</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">Sair</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
