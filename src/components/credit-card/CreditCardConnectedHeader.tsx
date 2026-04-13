import { CreditCard3D } from "./CreditCard3D";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2, Calendar, CreditCard, TrendingDown, ArrowUpRight, Hash } from "lucide-react";
import { formatCurrencyBR } from "@/lib/currency";
import { type CardBrand } from "@/lib/cardCatalog";

interface Props {
  brand: CardBrand;
  cycleName: string;
  dueDate: string | null;
  netAmount: number;
  grossAmount: number;
  reimbursementAmount: number;
  transactionCount: number;
  isDetecting: boolean;
  detect: () => void;
}

function formatDateFull(d: string | null) {
  if (!d) return "—";
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  } catch { return "—"; }
}

/** Ensure accent color is bright enough for dark backgrounds */
function ensureBrightAccent(hex: string): string {
  // Parse hex to RGB
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  // If dark, lighten it
  if (luminance < 0.45) {
    const factor = 1.6;
    const lr = Math.min(255, Math.round(r * factor + 60));
    const lg = Math.min(255, Math.round(g * factor + 60));
    const lb = Math.min(255, Math.round(b * factor + 60));
    return `#${lr.toString(16).padStart(2, "0")}${lg.toString(16).padStart(2, "0")}${lb.toString(16).padStart(2, "0")}`;
  }
  return hex;
}

export function CreditCardConnectedHeader({
  brand, cycleName, dueDate, netAmount, grossAmount, reimbursementAmount, transactionCount, isDetecting, detect,
}: Props) {
  const brightAccent = ensureBrightAccent(brand.accentColor);

  return (
    <section className="liquid-glass rounded-2xl overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-0 items-center">
        {/* Card 3D */}
        <div className="relative flex items-center justify-center p-8 min-h-[220px]">
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[180px] rounded-full blur-3xl opacity-25"
              style={{ background: brightAccent }}
            />
          </div>
          <CreditCard3D assetOverride={brand.asset} className="relative z-10" />
        </div>

        {/* Info */}
        <div className="p-6 md:p-8 flex flex-col justify-center space-y-5 lg:border-l border-white/[0.08]">
          {/* Title row */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <span className="text-foreground">Cartão</span>
                {brand.id !== "generic" ? (
                  <span
                    className="relative inline-block"
                    style={{
                      background: `linear-gradient(135deg, ${brightAccent} 0%, ${brightAccent}DD 50%, ${brightAccent}99 100%)`,
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      filter: `drop-shadow(0 0 16px ${brightAccent}AA) drop-shadow(0 0 6px ${brightAccent}66)`,
                    }}
                  >
                    {brand.name}
                  </span>
                ) : (
                  <span className="text-foreground">{brand.name}</span>
                )}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Vencimento: {formatDateFull(dueDate)}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 rounded-xl shrink-0"
              onClick={() => detect()}
              disabled={isDetecting}
            >
              {isDetecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Reprocessar
            </Button>
          </div>

          {/* Mini KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <MiniKPI
              icon={<CreditCard className="h-4 w-4" />}
              label="Fatura Líquida"
              value={formatCurrencyBR(netAmount)}
              color="text-primary"
            />
            <MiniKPI
              icon={<TrendingDown className="h-4 w-4" />}
              label="Despesas Brutas"
              value={formatCurrencyBR(grossAmount)}
              color="text-red-400"
            />
            <MiniKPI
              icon={<ArrowUpRight className="h-4 w-4" />}
              label="Reembolsos"
              value={formatCurrencyBR(reimbursementAmount)}
              color="text-emerald-400"
            />
            <MiniKPI
              icon={<Hash className="h-4 w-4" />}
              label="Lançamentos"
              value={String(transactionCount)}
              color="text-sky-400"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function MiniKPI({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="space-y-1">
      <div className={`flex items-center gap-1.5 text-xs text-muted-foreground`}>
        <span className={color}>{icon}</span>
        {label}
      </div>
      <p className="text-base font-bold text-foreground tabular-nums">{value}</p>
    </div>
  );
}
