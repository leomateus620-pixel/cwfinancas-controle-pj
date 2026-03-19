import { useState, useEffect } from "react";
import { User, Bell, Palette, Database, Shield, Loader2, LogOut, FileText, Copy, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export function SettingsPage() {
  const { profile, isLoading, updateProfile } = useProfile();
  const { user, signOut } = useAuth();
  const { toast } = useToast();

  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setCompanyName(profile.company_name || "");
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      await updateProfile.mutateAsync({
        full_name: fullName,
        company_name: companyName,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    toast({
      title: "Logout realizado",
      description: "Você foi desconectado com sucesso.",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

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
              <Input 
                id="name" 
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input 
                id="email" 
                type="email" 
                value={user?.email || ""} 
                disabled 
                className="bg-muted"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="company">Empresa</Label>
            <Input 
              id="company" 
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </div>
          <Button onClick={handleSaveProfile} disabled={isSaving}>
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar Alterações
          </Button>
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

      {/* Documentos Legais */}
      <Card className="border-border/50 shadow-premium-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="w-5 h-5 text-primary" />
            Documentos Legais
          </CardTitle>
          <CardDescription>
            Links públicos para uso no Google OAuth e conformidade legal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: "Página Inicial", url: "https://cwfinancas-controle-pj.lovable.app/" },
            { label: "Política de Privacidade", url: "https://cwfinancas-controle-pj.lovable.app/politica-de-privacidade" },
            { label: "Termos de Uso", url: "https://cwfinancas-controle-pj.lovable.app/termos-de-uso" },
          ].map((item, idx) => (
            <div key={idx}>
              {idx > 0 && <Separator className="mb-4" />}
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-foreground text-sm">{item.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.url}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      navigator.clipboard.writeText(item.url);
                      toast({ title: "Link copiado!", description: item.url });
                    }}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                    <a href={item.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          ))}
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
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Sair da Conta</p>
              <p className="text-sm text-muted-foreground">Encerrar sua sessão atual</p>
            </div>
            <Button variant="outline" onClick={handleLogout} className="gap-2">
              <LogOut className="w-4 h-4" />
              Sair
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default SettingsPage;
