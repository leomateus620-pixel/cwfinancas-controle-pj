interface Cycle {
  id: string;
  due_date: string;
  card_label?: string | null;
}

interface Props {
  cycles: Cycle[];
  selectedId: string | "all";
  onSelect: (id: string | "all") => void;
}

function formatCycleLabel(dueDate: string) {
  try {
    const d = new Date(dueDate + "T00:00:00");
    return d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" }).replace(".", "");
  } catch {
    return dueDate;
  }
}

export function CreditCardCycleSelector({ cycles, selectedId, onSelect }: Props) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
      {cycles.map((c) => {
        const active = selectedId === c.id;
        return (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`
              px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200
              ${active
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                : "liquid-glass text-muted-foreground hover:text-foreground hover:bg-white/[0.08]"
              }
            `}
          >
            {formatCycleLabel(c.due_date)}
          </button>
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
