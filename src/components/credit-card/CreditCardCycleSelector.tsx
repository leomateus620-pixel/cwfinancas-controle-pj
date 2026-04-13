import { useState } from "react";
import { detectCardBrand } from "@/lib/cardCatalog";

interface Cycle {
  id: string;
  due_date: string;
  period_key: string;
  card_label?: string | null;
}

interface Props {
  cycles: Cycle[];
  selectedId: string | "all";
  onSelect: (id: string | "all") => void;
}

function formatMonthLabel(periodKey: string) {
  try {
    const [y, m] = periodKey.split("-");
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" }).replace(".", "");
  } catch {
    return periodKey;
  }
}

/** Normalize grouping key — always use due_date month to avoid mismatches */
function getMonthKey(cycle: Cycle): string {
  if (cycle.due_date && cycle.due_date.length >= 7) {
    return cycle.due_date.substring(0, 7);
  }
  return cycle.period_key || "unknown";
}

interface MonthGroup {
  periodKey: string;
  label: string;
  cycles: Cycle[];
}

function ChipDot({ color, active }: { color: string; active: boolean }) {
  return (
    <span
      className="w-2.5 h-2.5 rounded-full shrink-0 transition-all duration-300"
      style={{
        background: active ? "#fff" : color,
        boxShadow: active ? `0 0 14px ${color}, 0 0 6px ${color}` : `0 0 8px ${color}88`,
      }}
    />
  );
}

function CycleChip({
  cycle,
  active,
  label,
  showBrandName,
  onClick,
}: {
  cycle: Cycle;
  active: boolean;
  label: string;
  showBrandName?: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const brand = detectCardBrand(cycle.card_label);
  const ac = brand.accentColor;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={`${cycle.card_label || brand.name} — ${label}`}
      className={`
        relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap
        transition-all duration-300 ease-out border backdrop-blur-md
        ${active ? "text-white scale-[1.02]" : "text-muted-foreground hover:text-foreground"}
      `}
      style={
        active
           ? {
               background: `linear-gradient(135deg, ${ac}99 0%, ${ac}55 100%)`,
               borderColor: `${ac}BB`,
               boxShadow: `0 4px 28px ${ac}66, 0 0 0 1px ${ac}44, inset 0 1px 0 rgba(255,255,255,0.2)`,
             }
           : {
               background: hovered ? `${ac}25` : "rgba(255,255,255,0.04)",
               borderColor: hovered ? `${ac}50` : "rgba(255,255,255,0.08)",
               boxShadow: hovered
                 ? `0 2px 16px ${ac}30, inset 0 1px 0 rgba(255,255,255,0.08)`
                 : "inset 0 1px 0 rgba(255,255,255,0.04)",
             }
      }
    >
      <ChipDot color={ac} active={active} />
      <span>{label}</span>
      {showBrandName && (
        <span className="text-xs opacity-60">{brand.name.split(" ").pop()}</span>
      )}
    </button>
  );
}

export function CreditCardCycleSelector({ cycles, selectedId, onSelect }: Props) {
  const months: MonthGroup[] = [];
  const monthMap = new Map<string, Cycle[]>();
  for (const c of cycles) {
    const pk = getMonthKey(c);
    if (!monthMap.has(pk)) monthMap.set(pk, []);
    monthMap.get(pk)!.push(c);
  }
  const sortedKeys = Array.from(monthMap.keys()).sort((a, b) => b.localeCompare(a));
  for (const pk of sortedKeys) {
    months.push({ periodKey: pk, label: formatMonthLabel(pk), cycles: monthMap.get(pk)! });
  }

  const [allHovered, setAllHovered] = useState(false);
  const allActive = selectedId === "all";

  return (
    <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none px-1">
      {months.map((month) => {
        if (month.cycles.length === 1) {
          const c = month.cycles[0];
          return (
            <CycleChip
              key={c.id}
              cycle={c}
              active={selectedId === c.id}
              label={month.label}
              onClick={() => onSelect(c.id)}
            />
          );
        }

        const anyActive = month.cycles.some((c) => c.id === selectedId);
        return (
          <div
            key={month.periodKey}
            className="flex items-center gap-0.5 rounded-xl overflow-hidden backdrop-blur-md border transition-all duration-300"
            style={{
              borderColor: anyActive ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)",
              boxShadow: anyActive
                ? "0 4px 20px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1)"
                : "inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            {month.cycles.map((c, idx) => {
              const active = selectedId === c.id;
              const brand = detectCardBrand(c.card_label);
              const ac = brand.accentColor;
              return (
                <CycleChipInner
                  key={c.id}
                  cycle={c}
                  active={active}
                  label={month.label}
                  accentColor={ac}
                  brandName={brand.name}
                  hasBorder={idx > 0}
                  onClick={() => onSelect(c.id)}
                />
              );
            })}
          </div>
        );
      })}

      {/* "Todos" button */}
      <button
        onClick={() => onSelect("all")}
        onMouseEnter={() => setAllHovered(true)}
        onMouseLeave={() => setAllHovered(false)}
        className={`
          px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap border backdrop-blur-md
          transition-all duration-300 ease-out
          ${allActive ? "text-white scale-[1.02]" : "text-muted-foreground hover:text-foreground"}
        `}
        style={
          allActive
            ? {
                background: "linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.10) 100%)",
                borderColor: "rgba(255,255,255,0.30)",
                boxShadow: "0 4px 24px rgba(255,255,255,0.10), 0 0 0 1px rgba(255,255,255,0.12), inset 0 1px 0 rgba(255,255,255,0.18)",
              }
            : {
                background: allHovered ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)",
                borderColor: allHovered ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.08)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
              }
        }
      >
        Todos
      </button>
    </div>
  );
}

/** Inner chip for grouped multi-card months */
function CycleChipInner({
  cycle,
  active,
  label,
  accentColor: ac,
  brandName,
  hasBorder,
  onClick,
}: {
  cycle: Cycle;
  active: boolean;
  label: string;
  accentColor: string;
  brandName: string;
  hasBorder: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={`${cycle.card_label || brandName} — ${label}`}
      className={`
        flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap
        transition-all duration-300 ease-out
        ${hasBorder ? "border-l" : ""}
        ${active ? "text-white" : "text-muted-foreground hover:text-foreground"}
      `}
      style={{
        borderLeftColor: hasBorder ? "rgba(255,255,255,0.08)" : undefined,
        ...(active
           ? {
               background: `linear-gradient(135deg, ${ac}99 0%, ${ac}55 100%)`,
               boxShadow: `0 2px 20px ${ac}55, inset 0 1px 0 rgba(255,255,255,0.15)`,
             }
           : {
               background: hovered ? `${ac}25` : "rgba(255,255,255,0.04)",
             }),
      }}
    >
      <ChipDot color={ac} active={active} />
      <span className="hidden sm:inline">{label}</span>
      <span className="text-xs opacity-70 font-semibold">{brandName.split(" ").pop()}</span>
    </button>
  );
}
