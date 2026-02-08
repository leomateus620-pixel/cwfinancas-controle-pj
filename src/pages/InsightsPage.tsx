import { Sparkles } from "lucide-react";
import { AIInsightsPanel } from "@/components/insights/AIInsightsPanel";

export function InsightsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
          <Sparkles className="w-7 h-7 text-primary animate-pulse-glow" />
          Insights com IA
        </h1>
        <p className="text-muted-foreground mt-1">
          Análise inteligente dos seus dados financeiros.
        </p>
      </div>
      
      <AIInsightsPanel />
    </div>
  );
}

export default InsightsPage;
