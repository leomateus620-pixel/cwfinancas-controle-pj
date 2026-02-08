import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface InsightCardProps {
  icon: LucideIcon;
  title: string;
  evidence: string;
  impact?: string;
  recommendation?: string;
  variant?: "default" | "success" | "warning" | "info";
}

export function InsightCard({
  icon: Icon,
  title,
  evidence,
  impact,
  recommendation,
  variant = "default",
}: InsightCardProps) {
  const variantStyles = {
    default: "border-border/50",
    success: "border-success/30 bg-success/5",
    warning: "border-warning/30 bg-warning/5",
    info: "border-primary/30 bg-primary/5",
  };

  const iconStyles = {
    default: "text-muted-foreground bg-muted/50",
    success: "text-success bg-success/10",
    warning: "text-warning bg-warning/10",
    info: "text-primary bg-primary/10",
  };

  return (
    <Card className={cn("glass-premium transition-premium hover:shadow-premium-md", variantStyles[variant])}>
      <CardContent className="p-4">
        <div className="flex gap-3">
          <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", iconStyles[variant])}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 space-y-2">
            <h4 className="font-semibold text-sm text-foreground">{title}</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">{evidence}</p>
            {impact && (
              <div className="flex items-start gap-2">
                <Badge variant="secondary" className="text-xs shrink-0">Impacto</Badge>
                <span className="text-xs text-muted-foreground">{impact}</span>
              </div>
            )}
            {recommendation && (
              <div className="pt-2 border-t border-border/50">
                <p className="text-xs text-primary font-medium">💡 {recommendation}</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
