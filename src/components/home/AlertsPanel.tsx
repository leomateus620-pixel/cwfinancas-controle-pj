import { GlassCard } from "./GlassCard";
import { AlertTriangle, AlertCircle, Info, CheckCircle } from "lucide-react";
import type { HomeDashboardAlert } from "@/hooks/useHomeDashboard";
import { cn } from "@/lib/utils";

interface AlertsPanelProps {
  alerts: HomeDashboardAlert[];
  delay?: number;
}

const priorityConfig = {
  high: { icon: AlertTriangle, color: "text-red-600", bg: "bg-red-600/10" },
  medium: { icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-600/10" },
  low: { icon: Info, color: "text-blue-600", bg: "bg-blue-600/10" },
};

export function AlertsPanel({ alerts, delay = 0 }: AlertsPanelProps) {
  const visible = alerts.slice(0, 5);

  return (
    <div
      className="opacity-0 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}
    >
      <GlassCard className="p-5 md:p-6 h-full">
        <h3 className="text-foreground/90 font-semibold text-sm mb-4">Alertas</h3>

        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <CheckCircle className="w-8 h-8 text-emerald-600/40 mb-2" />
            <p className="text-muted-foreground text-xs">Nenhum alerta no momento</p>
          </div>
        ) : (
          <div className="space-y-3 stagger-list">
            {visible.map(alert => {
              const config = priorityConfig[alert.priority];
              const Icon = config.icon;
              return (
                <div key={alert.id} className="flex items-start gap-3">
                  <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", config.bg)}>
                    <Icon className={cn("w-3.5 h-3.5", config.color)} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-foreground/80 text-xs font-medium">{alert.title}</p>
                    <p className="text-muted-foreground text-[11px] leading-relaxed mt-0.5">{alert.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
