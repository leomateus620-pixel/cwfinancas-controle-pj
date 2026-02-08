import { AlertTriangle, ShieldAlert, Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface RiskCardProps {
  title: string;
  evidence: string;
  severity: "low" | "medium" | "high";
  mitigation: string;
}

export function RiskCard({ title, evidence, severity, mitigation }: RiskCardProps) {
  const severityConfig = {
    low: {
      icon: Shield,
      badge: "Baixo",
      bgColor: "bg-muted/50",
      borderColor: "border-muted",
      iconColor: "text-muted-foreground",
      badgeClass: "bg-muted text-muted-foreground",
    },
    medium: {
      icon: AlertTriangle,
      badge: "Médio",
      bgColor: "bg-warning/5",
      borderColor: "border-warning/30",
      iconColor: "text-warning",
      badgeClass: "bg-warning/10 text-warning border-warning/30",
    },
    high: {
      icon: ShieldAlert,
      badge: "Alto",
      bgColor: "bg-destructive/5",
      borderColor: "border-destructive/30",
      iconColor: "text-destructive",
      badgeClass: "bg-destructive/10 text-destructive border-destructive/30",
    },
  };

  const config = severityConfig[severity];
  const Icon = config.icon;

  return (
    <Card className={cn("glass-premium transition-premium", config.borderColor, config.bgColor)}>
      <CardContent className="p-4">
        <div className="flex gap-3">
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
            severity === "high" ? "bg-destructive/10" : severity === "medium" ? "bg-warning/10" : "bg-muted"
          )}>
            <Icon className={cn("w-5 h-5", config.iconColor)} />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm text-foreground">{title}</h4>
              <Badge className={config.badgeClass}>{config.badge}</Badge>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{evidence}</p>
            <div className="pt-2 border-t border-border/50">
              <p className="text-xs">
                <span className="font-medium text-foreground">Mitigação: </span>
                <span className="text-muted-foreground">{mitigation}</span>
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
