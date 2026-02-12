import { useState } from "react";
import { useLocation } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { ptBR } from "date-fns/locale";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useDateRange } from "@/contexts/DateRangeContext";

const ALLOWED_ROUTES = ["/overview", "/income", "/expenses", "/cash-flow"];

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
  const location = useLocation();
  const { range, preset, setPreset, setCustomRange, rangeLabel, formattedRange } = useDateRange();
  const [open, setOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState<Date | undefined>(range.from);
  const [customTo, setCustomTo] = useState<Date | undefined>(range.to);

  if (!ALLOWED_ROUTES.includes(location.pathname)) return null;

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
          <button
            className="liquid-glass-compact flex items-center gap-2 px-3 py-1.5 rounded-xl cursor-pointer transition-all duration-200 text-sm"
          >
            <CalendarDays className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium text-foreground">{rangeLabel}</span>
            <span className="text-[10px] text-muted-foreground">{formattedRange}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0 border-none shadow-xl"
          align="end"
          sideOffset={8}
          style={{
            background: "rgba(255, 255, 255, 0.75)",
            backdropFilter: "blur(24px) saturate(120%)",
            borderRadius: "16px",
            border: "1px solid rgba(255,255,255,0.5)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)",
          }}
        >
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
                      "px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200",
                      preset === opt.key
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "liquid-glass-compact hover:border-foreground/10"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <Separator className="opacity-30" />

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
                    className="p-2 pointer-events-auto text-xs"
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
                    className="p-2 pointer-events-auto text-xs"
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
