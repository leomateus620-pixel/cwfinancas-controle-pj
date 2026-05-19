import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole, AppRole } from "@/hooks/useUserRole";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: AppRole;
}

// Routes a "cliente" user is allowed to land on (anything else redirects to /demands/new).
const CLIENT_ALLOWED_PREFIXES = ["/demands/new"];

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { hasRole, isClient, isLoading: roleLoading } = useUserRole();
  const location = useLocation();

  if (authLoading || (user && roleLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Clients are restricted to the new-demand flow only.
  if (isClient) {
    const allowed = CLIENT_ALLOWED_PREFIXES.some(
      (p) => location.pathname === p || location.pathname.startsWith(p + "/"),
    );
    if (!allowed) {
      return <Navigate to="/demands/new" replace />;
    }
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
