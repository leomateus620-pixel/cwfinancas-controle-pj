import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, UserPlus, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { registerSchema, RegisterFormData } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import logoFull from "@/assets/logo-full.png";

export function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const slugifyUsername = (name: string) => {
    const base = name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.+|\.+$/g, "")
      .replace(/\.{2,}/g, ".");
    return base.length >= 3 ? base : `user.${Math.random().toString(36).slice(2, 8)}`;
  };

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    try {
      const hasEmail = !!data.email && data.email.trim().length > 0;
      const username = hasEmail ? undefined : slugifyUsername(data.full_name);
      const emailToUse = hasEmail
        ? data.email!.trim()
        : `${username}@cliente.cwfinancas.local`;

      const { error } = await signUp(emailToUse, data.password, {
        full_name: data.full_name,
        company_name: data.company_name,
        ...(username ? { username } : {}),
      });

      if (error) {
        toast({
          variant: "destructive",
          title: "Erro ao criar conta",
          description: error.message,
        });
      } else {
        toast({
          title: "Conta criada com sucesso!",
          description: hasEmail
            ? "Você já pode acessar sua conta."
            : `Seu usuário de acesso é: ${username}. Anote para fazer login.`,
        });
        navigate("/login");
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro inesperado",
        description: "Tente novamente mais tarde.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = "bg-background/50 backdrop-blur-sm border-border/60 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl h-11";

  return (
    <div className="min-h-screen flex items-center justify-center home-glass-bg relative overflow-hidden p-4">
      <div className="w-full max-w-md relative z-10">
        {/* Logo + Branding */}
        <div className="text-center mb-8">
          <img src={logoFull} alt="CW Finanças" className="h-16 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-foreground tracking-tight">CW Finanças</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium tracking-wide uppercase">Controle PJ</p>
        </div>

        {/* Glass Card */}
        <div className="liquid-glass rounded-2xl p-8">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-foreground">Criar Conta</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Preencha os dados para criar sua conta
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Nome Completo</Label>
              <Input
                id="full_name"
                type="text"
                {...register("full_name")}
                className={`${inputClass} ${errors.full_name ? "border-destructive" : ""}`}
              />
              {errors.full_name && (
                <p className="text-sm text-destructive">{errors.full_name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="company_name">Nome da Empresa</Label>
              <Input
                id="company_name"
                type="text"
                {...register("company_name")}
                className={`${inputClass} ${errors.company_name ? "border-destructive" : ""}`}
              />
              {errors.company_name && (
                <p className="text-sm text-destructive">{errors.company_name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                {...register("email")}
                className={`${inputClass} ${errors.email ? "border-destructive" : ""}`}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  {...register("password")}
                  className={`${inputClass} pr-10 ${errors.password ? "border-destructive" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Senha</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                {...register("confirmPassword")}
                className={`${inputClass} ${errors.confirmPassword ? "border-destructive" : ""}`}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full gap-2 h-11 rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/20 text-primary-foreground font-medium mt-2" 
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              Criar Conta
            </Button>

            <p className="text-sm text-center text-muted-foreground">
              Já tem uma conta?{" "}
              <Link to="/login" className="text-primary hover:underline font-medium">
                Entrar
              </Link>
            </p>
          </form>
        </div>

        {/* Legal footer */}
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

export default RegisterPage;
