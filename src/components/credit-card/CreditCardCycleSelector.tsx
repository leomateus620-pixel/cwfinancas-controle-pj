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

interface MonthGroup {
  periodKey: string;
  label: string;
  cycles: Cycle[];
}

export function CreditCardCycleSelector({ cycles, selectedId, onSelect }: Props) {
  // Group cycles by period_key (month)
  const months: MonthGroup[] = [];
  const monthMap = new Map<string, Cycle[]>();
  for (const c of cycles) {
    const pk = c.period_key || c.due_date?.substring(0, 7) || "unknown";
    if (!monthMap.has(pk)) monthMap.set(pk, []);
    monthMap.get(pk)!.push(c);
  }
  // Sort months descending
  const sortedKeys = Array.from(monthMap.keys()).sort((a, b) => b.localeCompare(a));
  for (const pk of sortedKeys) {
    months.push({ periodKey: pk, label: formatMonthLabel(pk), cycles: monthMap.get(pk)! });
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
      {months.map((month) => {
        const hasMultipleCards = month.cycles.length > 1;
        
        if (!hasMultipleCards) {
          // Single card month — simple button
          const c = month.cycles[0];
          const active = selectedId === c.id;
          const brand = detectCardBrand(c.card_label);
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200
                ${active
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                  : "liquid-glass text-muted-foreground hover:text-foreground hover:bg-white/[0.08]"
                }
              `}
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: brand.accentColor }} />
              {month.label}
            </button>
          );
        }

        // Multiple cards in same month — show grouped
        const anyActive = month.cycles.some(c => c.id === selectedId);
        return (
          <div key={month.periodKey} className={`
            flex items-center gap-0.5 rounded-xl overflow-hidden border transition-all duration-200
            ${anyActive ? "border-primary/30 shadow-lg shadow-primary/10" : "border-white/[0.06]"}
          `}>
            {month.cycles.map((c, idx) => {
              const active = selectedId === c.id;
              const brand = detectCardBrand(c.card_label);
              return (
                <button
                  key={c.id}
                  onClick={() => onSelect(c.id)}
                  className={`
                    flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap transition-all duration-200
                    ${idx > 0 ? "border-l border-white/[0.06]" : ""}
                    ${active
                      ? "bg-primary text-primary-foreground"
                      : "bg-white/[0.04] text-muted-foreground hover:text-foreground hover:bg-white/[0.08]"
                    }
                  `}
                  title={`${c.card_label || brand.name} — ${month.label}`}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: active ? "#fff" : brand.accentColor }} />
                  <span className="hidden sm:inline">{month.label}</span>
                  <span className="text-xs opacity-70">{brand.name.split(" ").pop()}</span>
                </button>
              );
            })}
          </div>
        );
      })}
      <button
        onClick={() => onSelect("all")}
        className={`
          px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200
          ${selectedId === "all"
            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
            : "liquid-glass text-muted-foreground hover:text-foreground hover:bg-white/[0.08]"
          }
        `}
      >
        Todos
      </button>
    </div>
  );
}
