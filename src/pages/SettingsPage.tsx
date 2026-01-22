import { User, Bell, Palette, Database, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
          Configurações
        </h1>
        <p className="text-muted-foreground mt-1">
          Gerencie sua conta e preferências.
        </p>
      </div>
      
      {/* Perfil */}
      <Card className="border-border/50 shadow-premium-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="w-5 h-5 text-primary" />
            Perfil
          </CardTitle>
          <CardDescription>
            Suas informações pessoais e de conta.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" defaultValue="João Silva" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" defaultValue="joao@empresa.com" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="company">Empresa</Label>
            <Input id="company" defaultValue="FinSight Ltda." />
          </div>
          <Button>Salvar Alterações</Button>
        </CardContent>
      </Card>

      {/* Notificações */}
      <Card className="border-border/50 shadow-premium-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="w-5 h-5 text-primary" />
            Notificações
          </CardTitle>
          <CardDescription>
            Configure como você deseja receber alertas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Alertas por E-mail</p>
              <p className="text-sm text-muted-foreground">Receba resumos semanais por e-mail</p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Alertas de Anomalias</p>
              <p className="text-sm text-muted-foreground">Notificações quando gastos saírem do padrão</p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Relatórios Mensais</p>
              <p className="text-sm text-muted-foreground">Enviar relatório completo no fim do mês</p>
            </div>
            <Switch />
          </div>
        </CardContent>
      </Card>

      {/* Aparência */}
      <Card className="border-border/50 shadow-premium-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Palette className="w-5 h-5 text-primary" />
            Aparência
          </CardTitle>
          <CardDescription>
            Personalize a aparência do dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Modo Escuro</p>
              <p className="text-sm text-muted-foreground">Alternar entre tema claro e escuro</p>
            </div>
            <Switch />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Animações</p>
              <p className="text-sm text-muted-foreground">Desativar animações para melhor performance</p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      {/* Dados */}
      <Card className="border-border/50 shadow-premium-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Database className="w-5 h-5 text-primary" />
            Gerenciamento de Dados
          </CardTitle>
          <CardDescription>
            Gerencie seus dados e histórico de uploads.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Exportar Todos os Dados</p>
              <p className="text-sm text-muted-foreground">Baixar todos os seus dados em formato CSV</p>
            </div>
            <Button variant="outline">Exportar</Button>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground text-destructive">Limpar Todos os Dados</p>
              <p className="text-sm text-muted-foreground">Remover todos os dados importados</p>
            </div>
            <Button variant="destructive">Limpar</Button>
          </div>
        </CardContent>
      </Card>

      {/* Segurança */}
      <Card className="border-border/50 shadow-premium-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="w-5 h-5 text-primary" />
            Segurança
          </CardTitle>
          <CardDescription>
            Configurações de segurança da sua conta.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Alterar Senha</p>
              <p className="text-sm text-muted-foreground">Atualize sua senha de acesso</p>
            </div>
            <Button variant="outline">Alterar</Button>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Autenticação de Dois Fatores</p>
              <p className="text-sm text-muted-foreground">Adicione uma camada extra de segurança</p>
            </div>
            <Switch />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default SettingsPage;
