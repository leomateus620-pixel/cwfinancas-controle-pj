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

/** Brand title with shimmer animation and glow */
function BrandTitle({ brand }: { brand: CardBrand }) {
  const [c1, c2, c3] = brand.glowColors ?? ["#4A90D9", "#6BB3FF", "#A8D8FF"];

  return (
    <span className="relative inline-block">
      <span
        className="relative z-10 text-3xl font-extrabold tracking-tight animate-cc-shimmer"
        style={{
          background: `linear-gradient(90deg, ${c1}, ${c2}, ${c3}, ${c2}, ${c1})`,
          backgroundSize: "200% auto",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          filter: `drop-shadow(0 0 6px ${c1}66) drop-shadow(0 0 14px ${c1}44) drop-shadow(0 0 28px ${c1}22)`,
        }}
      >
        {brand.name}
      </span>
      {/* Reflection glow beneath text */}
      <span
        aria-hidden
        className="absolute left-0 top-[85%] z-0 w-full h-[60%] pointer-events-none select-none text-3xl font-extrabold tracking-tight"
        style={{
          background: `linear-gradient(90deg, ${c1}, ${c2}, ${c3}, ${c2}, ${c1})`,
          backgroundSize: "200% auto",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          filter: `blur(12px)`,
          opacity: 0.2,
          transform: "scaleY(-0.5)",
        }}
      >
        {brand.name}
      </span>
    </span>
  );
}

export function CreditCardConnectedHeader({
  brand, cycleName, dueDate, netAmount, grossAmount, reimbursementAmount, transactionCount, isDetecting, detect,
}: Props) {
  const [c1] = brand.glowColors ?? ["#4A90D9", "#6BB3FF", "#A8D8FF"];

  return (
    <section className="liquid-glass rounded-2xl overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-0 items-center">
        {/* Card 3D */}
        <div className="relative flex items-center justify-center p-8 min-h-[220px]">
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[180px] rounded-full blur-3xl opacity-25"
              style={{ background: c1 }}
            />
          </div>
          <CreditCard3D assetOverride={brand.asset} className="relative z-10" />
        </div>

        {/* Info */}
        <div className="p-6 md:p-8 flex flex-col justify-center space-y-5 lg:border-l border-white/[0.08]">
          {/* Title row */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2 leading-tight">
                {brand.id !== "generic" ? (
                  <>
                    <span
                      className="animate-cc-shimmer font-bold tracking-tight text-3xl font-serif border border-solid rounded-md shadow-2xl opacity-90"
                      style={{
                        background: `linear-gradient(90deg, #ffffffcc, ${(brand.glowColors ?? ["#4A90D9"])[0]}88, #ffffffcc)`,
                        backgroundSize: "200% auto",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                      }}
                    >
                      Cartão
                    </span>
                    <BrandTitle brand={brand} />
                  </>
                ) : (
                  <span className="text-foreground text-3xl font-extrabold">{brand.name}</span>
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
