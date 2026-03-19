import { useEffect } from "react";
import { toast } from "@/hooks/use-toast";

// Safe error string extraction - handles any type of error
function getErrorString(reason: unknown): string {
  if (typeof reason === 'string') return reason;
  
  if (reason instanceof Error) {
    return reason.message;
  }
  
  if (typeof reason === 'object' && reason !== null) {
    const obj = reason as Record<string, unknown>;
    if (typeof obj.message === 'string') return obj.message;
    if (typeof obj.error === 'string') return obj.error;
  }
  
  try {
    const serialized = JSON.stringify(reason);
    if (serialized.length > 150) {
      return "Ocorreu um erro inesperado";
    }
    return serialized;
  } catch {
    return "Erro desconhecido";
  }
}

export function GlobalErrorHandler() {
  useEffect(() => {
    // Handle unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const errorMessage = getErrorString(event.reason);
      
      // Auth refresh errors are handled by AuthContext
      const isAuthError = errorMessage.includes("Refresh Token") 
        || errorMessage.includes("refresh_token")
        || errorMessage.includes("invalid_refresh_token");
      if (isAuthError) {
        event.preventDefault();
        return;
      }

      console.error("Unhandled promise rejection:", event.reason);
      event.preventDefault();
      
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    };

    // Handle runtime errors
    const handleError = (event: ErrorEvent) => {
      console.error("Runtime error:", event.error);
      
      const errorMessage = event.message || getErrorString(event.error) || "Algo deu errado. Tente novamente.";
      
      toast({
        title: "Erro inesperado",
        description: errorMessage,
        variant: "destructive",
      });
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    window.addEventListener("error", handleError);

    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      window.removeEventListener("error", handleError);
    };
  }, []);

  return null;
}

export default GlobalErrorHandler;
