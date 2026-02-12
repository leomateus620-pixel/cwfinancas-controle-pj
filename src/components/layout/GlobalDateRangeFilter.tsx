import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useDateRange } from "@/contexts/DateRangeContext";

const PRESET_OPTIONS = [
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "3m", label: "3m" },
  { key: "6m", label: "6m" },
  { key: "12m", label: "12m" },
  { key: "month", label: "Mês" },
  { key: "year", label: "Ano" },
];

export function GlobalDateRangeFilter() {
  const { range, preset, setPreset, setCustomRange, rangeLabel, formattedRange } = useDateRange();
  const [open, setOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState<Date | undefined>(range.from);
  const [customTo, setCustomTo] = useState<Date | undefined>(range.to);

  const handlePresetClick = (key: string) => {
    setPreset(key);
    setOpen(false);
  };

  const handleApplyCustom = () => {
    if (customFrom && customTo) {
      setCustomRange(customFrom, customTo);
      setOpen(false);
    }
  };

  return (
    <div className="hidden lg:flex items-center">
      <Popover open={open} onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          setCustomFrom(range.from);
          setCustomTo(range.to);
        }
      }}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="gap-2 rounded-lg border-border hover:bg-accent text-sm h-9 px-3"
          >
            <CalendarDays className="w-4 h-4 text-muted-foreground" />
            <span className="text-foreground font-medium">{rangeLabel}</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 font-normal text-muted-foreground">
              {formattedRange}
            </Badge>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end" sideOffset={8}>
          <div className="p-4 space-y-4">
            {/* Presets */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Período rápido
              </p>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => handlePresetClick(opt.key)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                      preset === opt.key
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-accent"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Custom range */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Personalizar
              </p>
              <div className="flex gap-4">
                <div>
                  <p className="text-[11px] text-muted-foreground mb-1">Início</p>
                  <Calendar
                    mode="single"
                    selected={customFrom}
                    onSelect={setCustomFrom}
                    locale={ptBR}
                    className={cn("p-2 pointer-events-auto text-xs")}
                    disabled={(date) => customTo ? date > customTo : false}
                  />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground mb-1">Fim</p>
                  <Calendar
                    mode="single"
                    selected={customTo}
                    onSelect={setCustomTo}
                    locale={ptBR}
                    className={cn("p-2 pointer-events-auto text-xs")}
                    disabled={(date) => customFrom ? date < customFrom : false}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-3">
                <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleApplyCustom}
                  disabled={!customFrom || !customTo}
                >
                  Aplicar
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
