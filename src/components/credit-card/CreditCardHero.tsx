import { CreditCard3D } from "./CreditCard3D";
import { Button } from "@/components/ui/button";
import { Search, Loader2, RefreshCw, CreditCard, ReceiptText, Layers } from "lucide-react";

interface HeroProps {
  hasData: boolean;
  isDetecting: boolean;
  connectionId: string | null;
  detect: () => void;
  cycleCount: number;
  transactionCount: number;
  lastDetection?: string | null;
}

function formatDateShort(d: string | null | undefined) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  } catch {
    return "—";
  }
}

export function CreditCardHero({ hasData, isDetecting, connectionId, detect, cycleCount, transactionCount, lastDetection }: HeroProps) {
  return (
    <section className="liquid-glass rounded-2xl overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
        {/* Left column — text */}
        <div className="p-8 md:p-10 flex flex-col justify-center space-y-6">
          {/* Eyebrow */}
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">
              Cartão corporativo
            </span>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground leading-tight">
              Cartão de Crédito
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-md">
              Detecte automaticamente faturas e lançamentos do cartão corporativo a partir das planilhas integradas, com separação entre despesas e reembolsos.
            </p>
          </div>

          {/* CTAs */}
          <div className="flex flex-wrap items-center gap-3">
            {hasData ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 rounded-xl"
                onClick={() => detect()}
                disabled={isDetecting}
              >
                <RefreshCw className={`h-4 w-4 ${isDetecting ? "animate-spin" : ""}`} />
                Reprocessar
              </Button>
            ) : (
              <Button
                size="default"
                className="gap-2 rounded-xl px-6 shadow-lg shadow-primary/20"
                onClick={() => detect()}
                disabled={isDetecting || !connectionId}
              >
                {isDetecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Conectar cartão
              </Button>
            )}
            {!connectionId && (
              <span className="text-xs text-muted-foreground/60">
                Conecte uma planilha primeiro.
              </span>
            )}
          </div>

          {/* Mini KPIs */}
          <div className="flex items-center gap-6 pt-2">
            <MiniStat icon={<Layers className="h-3.5 w-3.5" />} label="Faturas" value={String(cycleCount)} />
            <MiniStat icon={<ReceiptText className="h-3.5 w-3.5" />} label="Lançamentos" value={String(transactionCount)} />
            <MiniStat
              icon={<RefreshCw className="h-3.5 w-3.5" />}
              label="Última análise"
              value={lastDetection ? formatDateShort(lastDetection) : "pendente"}
            />
          </div>
        </div>

        {/* Right column — 3D card */}
        <div className="relative flex items-center justify-center p-8 md:p-10 min-h-[280px]">
          {/* Subtle background glow */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-r-2xl">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] h-[200px] rounded-full bg-primary/8 blur-3xl" />
          </div>
          <CreditCard3D className="relative z-10" />
        </div>
      </div>
    </section>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <span className="text-primary/70">{icon}</span>
      <div className="flex flex-col leading-none">
        <span className="text-[11px] font-medium text-foreground tabular-nums">{value}</span>
        <span className="text-[10px]">{label}</span>
      </div>
    </div>
  );
}
