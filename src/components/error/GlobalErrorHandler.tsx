import { useEffect } from "react";
import { toast } from "@/hooks/use-toast";

export function GlobalErrorHandler() {
  useEffect(() => {
    // Handle unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error("Unhandled promise rejection:", event.reason);
      
      // Prevent the default behavior
      event.preventDefault();
      
      // Show toast notification
      const errorMessage = event.reason instanceof Error 
        ? event.reason.message 
        : "Ocorreu um erro inesperado";
      
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    };

    // Handle runtime errors
    const handleError = (event: ErrorEvent) => {
      console.error("Runtime error:", event.error);
      
      // Show toast notification for runtime errors
      toast({
        title: "Erro inesperado",
        description: event.message || "Algo deu errado. Tente novamente.",
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
