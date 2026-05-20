import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Loader2, LogIn, Eye, EyeOff, User as UserIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { resolveLoginEmail } from "@/lib/clientAuth";
import logoFull from "@/assets/logo-full.png";

export function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({});
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || "/dashboard";

  const isUsername = identifier.length > 0 && !identifier.includes("@");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!identifier.trim()) next.identifier = "Informe seu usuário ou e-mail";
    if (password.length < 6) next.password = "Senha deve ter no mínimo 6 caracteres";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setIsLoading(true);
    try {
      const loginEmail = resolveLoginEmail(identifier);
      const { error } = await signIn(loginEmail, password);
      if (error) {
        const raw = error.message ?? "";
        const isNetwork = /failed to fetch|networkerror|load failed/i.test(raw);
        const msg = isNetwork
          ? "Não foi possível conectar ao servidor. Verifique sua conexão (ou desative extensões do navegador que bloqueiem requisições) e tente novamente."
          : raw === "Invalid login credentials"
            ? (isUsername ? "Usuário ou senha incorretos" : "E-mail ou senha incorretos")
            : raw === "Email not confirmed"
              ? "Conta ainda não confirmada. Verifique seu e-mail."
              : raw;
        toast({ variant: "destructive", title: "Não foi possível entrar", description: msg });
      } else {
        navigate(from, { replace: true });
      }
    } catch (e) {
      const raw = (e as Error)?.message ?? "";
      const isNetwork = /failed to fetch|networkerror|load failed/i.test(raw);
      toast({
        variant: "destructive",
        title: "Erro inesperado",
        description: isNetwork
          ? "Falha de rede ao contatar o servidor. Verifique sua conexão e tente novamente."
          : "Tente novamente mais tarde.",
      });
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center home-glass-bg relative overflow-hidden p-4">
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <img src={logoFull} alt="CW Finanças" className="w-[250px] h-[250px] mx-auto object-contain" />
        </div>

        <div className="liquid-glass rounded-2xl p-8">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-foreground">Entrar</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Use seu <strong>usuário</strong> ou <strong>e-mail</strong> para acessar.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="identifier">Usuário ou e-mail</Label>
              <div className="relative">
                <Input
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="ex: joao  ou  joao@empresa.com"
                  className={`bg-background/50 backdrop-blur-sm border-border/60 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl h-11 pr-10 ${errors.identifier ? "border-destructive" : ""}`}
                />
                {isUsername && (
                  <UserIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden />
                )}
              </div>
              {errors.identifier && <p className="text-sm text-destructive">{errors.identifier}</p>}
              {isUsername && (
                <p className="text-[11px] text-muted-foreground">Detectado acesso de cliente — somente usuário e senha.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`bg-background/50 backdrop-blur-sm border-border/60 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl h-11 pr-10 ${errors.password ? "border-destructive" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
            </div>

            {!isUsername && (
              <div className="text-right">
                <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                  Esqueceu a senha?
                </Link>
              </div>
            )}

            <Button
              type="submit"
              className="w-full gap-2 h-11 rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/20 text-primary-foreground font-medium"
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              Entrar
            </Button>

          </form>
        </div>

        <div className="flex items-center justify-center gap-3 mt-6 text-xs text-muted-foreground">
          <Link to="/politica-de-privacidade" className="hover:text-primary hover:underline">
            Política de Privacidade
          </Link>
          <span>•</span>
          <Link to="/termos-de-uso" className="hover:text-primary hover:underline">
            Termos de Uso
          </Link>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
