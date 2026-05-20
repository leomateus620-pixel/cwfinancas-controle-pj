import { DemandTypeIcon, type DemandIconKey } from "@/components/demands/ui/DemandTypeIcon";
import { cn } from "@/lib/utils";

interface Props {
  code: string;
  typeKey: string;
  typeLabel: string;
  title: string;
  company?: string;
  requester?: string;
  priorityLabel?: string;
  amount?: string;
  compact?: boolean;
  className?: string;
}

export function DemandMiniCard({
  code,
  typeKey,
  typeLabel,
  title,
  company,
  requester,
  priorityLabel,
  amount,
  compact,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "inline-flex items-stretch gap-3 rounded-2xl bg-white/75 border border-white/70 backdrop-blur-xl px-4 py-3 text-left",
        "shadow-[0_10px_30px_-12px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.7)]",
        "ring-1 ring-black/[0.03]",
        compact ? "max-w-[260px]" : "max-w-sm",
        className,
      )}
    >
      <div className="flex-shrink-0 self-center">
        <DemandTypeIcon kind={(typeKey as DemandIconKey) || "outro"} size={compact ? "sm" : "md"} />
      </div>
      <div className="min-w-0 flex flex-col justify-center">
        <div className="flex items-center gap-1.5">
          <span className="text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">
            {typeLabel}
          </span>
          <span className="text-[9.5px] font-mono tabular-nums text-muted-foreground/80">
            #{code}
          </span>
        </div>
        <div className="text-[13px] font-semibold text-foreground truncate mt-0.5">
          {title}
        </div>
        {(company || requester) && (
          <div className="text-[11px] text-muted-foreground truncate mt-0.5">
            {[requester, company].filter(Boolean).join(" • ")}
          </div>
        )}
        {(amount || priorityLabel) && (
          <div className="flex items-center gap-2 mt-1.5">
            {amount && (
              <span className="text-[11px] font-mono tabular-nums font-semibold text-emerald-700">
                R$ {amount}
              </span>
            )}
            {priorityLabel && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-700 border border-blue-500/15">
                {priorityLabel}
              </span>
            )}
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/12 text-emerald-700 border border-emerald-500/15 ml-auto">
              Recebida
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
