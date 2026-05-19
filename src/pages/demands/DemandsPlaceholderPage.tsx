import { GlassCard } from "@/components/home/GlassCard";
import { Construction } from "lucide-react";

interface Props { title: string; description?: string }

export default function DemandsPlaceholderPage({ title, description }: Props) {
  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      <GlassCard className="p-16 text-center">
        <Construction className="w-12 h-12 mx-auto text-primary/60 mb-4" />
        <h3 className="text-base font-semibold">Em breve</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
          Esta tela faz parte da Central de Demandas Financeiras e será liberada nas próximas etapas do módulo.
        </p>
      </GlassCard>
    </div>
  );
}
