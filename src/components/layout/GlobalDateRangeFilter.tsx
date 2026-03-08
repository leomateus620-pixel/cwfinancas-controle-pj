import { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { CalendarDays, ArrowRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { ptBR } from "date-fns/locale";
import { format, subDays, subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear, parse, isValid } from "date-fns";
import type { DateRange as RDPDateRange } from "react-day-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useDateRange } from "@/contexts/DateRangeContext";

const ALLOWED_ROUTES = ["/overview", "/income", "/expenses", "/cash-flow"];

const PRESET_OPTIONS = [
  { key: "7d", label: "7 dias", desc: () => `${format(subDays(new Date(), 7), "dd/MM")} – ${format(new Date(), "dd/MM")}` },
  { key: "30d", label: "30 dias", desc: () => `${format(subDays(new Date(), 30), "dd/MM")} – ${format(new Date(), "dd/MM")}` },
  { key: "3m", label: "3 meses", desc: () => `${format(subMonths(new Date(), 3), "dd/MM")} – ${format(new Date(), "dd/MM")}` },
  { key: "6m", label: "6 meses", desc: () => `${format(subMonths(new Date(), 6), "dd/MM")} – ${format(new Date(), "dd/MM")}` },
  { key: "12m", label: "12 meses", desc: () => `${format(subMonths(new Date(), 12), "dd/MM")} – ${format(new Date(), "dd/MM")}` },
  { key: "month", label: "Mês atual", desc: () => `${format(startOfMonth(new Date()), "dd/MM")} – ${format(endOfMonth(new Date()), "dd/MM")}` },
  { key: "year", label: "Ano atual", desc: () => `${format(startOfYear(new Date()), "dd/MM")} – ${format(endOfYear(new Date()), "dd/MM")}` },
];

export function GlobalDateRangeFilter() {
  const location = useLocation();
  const { range, preset, setPreset, setCustomRange, rangeLabel, formattedRange } = useDateRange();
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [selectedRange, setSelectedRange] = useState<RDPDateRange | undefined>({
    from: range.from,
    to: range.to,
  });
  const [fromInput, setFromInput] = useState(format(range.from, "dd/MM/yyyy"));
  const [toInput, setToInput] = useState(format(range.to, "dd/MM/yyyy"));
  const fromRef = useRef<HTMLInputElement>(null);
  const toRef = useRef<HTMLInputElement>(null);

  if (!ALLOWED_ROUTES.includes(location.pathname)) return null;

  // Sync inputs when calendar selection changes
  const handleRangeSelect = (newRange: RDPDateRange | undefined) => {
    setSelectedRange(newRange);
    if (newRange?.from) setFromInput(format(newRange.from, "dd/MM/yyyy"));
    if (newRange?.to) setToInput(format(newRange.to, "dd/MM/yyyy"));
  };

  const handleFromInputBlur = () => {
    const parsed = parse(fromInput, "dd/MM/yyyy", new Date());
    if (isValid(parsed)) {
      setSelectedRange(prev => ({ from: parsed, to: prev?.to }));
    }
  };

  const handleToInputBlur = () => {
    const parsed = parse(toInput, "dd/MM/yyyy", new Date());
    if (isValid(parsed)) {
      setSelectedRange(prev => ({ from: prev?.from, to: parsed }));
    }
  };

  const handlePresetClick = (key: string) => {
    setPreset(key);
    setOpen(false);
  };

  const handleApplyCustom = () => {
    if (selectedRange?.from && selectedRange?.to) {
      setCustomRange(selectedRange.from, selectedRange.to);
      setOpen(false);
    }
  };

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (v) {
      setSelectedRange({ from: range.from, to: range.to });
      setFromInput(format(range.from, "dd/MM/yyyy"));
      setToInput(format(range.to, "dd/MM/yyyy"));
    }
  };

  const hasValidCustomRange = selectedRange?.from && selectedRange?.to;

  return (
    <div className="hidden lg:flex items-center">
      <Popover open={open} onOpenChange={handleOpenChange}>
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
            background: "rgba(255, 255, 255, 0.8)",
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
              <div className="grid grid-cols-2 gap-1.5">
                {PRESET_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => handlePresetClick(opt.key)}
                    className={cn(
                      "group px-3 py-2 text-left rounded-lg transition-all duration-200",
                      preset === opt.key
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "hover:bg-accent/60"
                    )}
                  >
                    <span className={cn(
                      "text-xs font-medium block",
                      preset === opt.key ? "text-primary-foreground" : "text-foreground"
                    )}>
                      {opt.label}
                    </span>
                    <span className={cn(
                      "text-[10px] block mt-0.5 transition-opacity",
                      preset === opt.key
                        ? "text-primary-foreground/70"
                        : "text-muted-foreground opacity-0 group-hover:opacity-100"
                    )}>
                      {opt.desc()}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <Separator className="opacity-30" />

            {/* Custom range */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Personalizar
              </p>

              {/* Date inputs */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1">
                  <label className="text-[10px] text-muted-foreground mb-1 block">Início</label>
                  <input
                    ref={fromRef}
                    type="text"
                    value={fromInput}
                    onChange={(e) => setFromInput(e.target.value)}
                    onBlur={handleFromInputBlur}
                    placeholder="dd/mm/aaaa"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border/50 bg-background/50 backdrop-blur-sm focus:outline-none focus:ring-1 focus:ring-primary/30 text-foreground"
                  />
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground mt-4 shrink-0" />
                <div className="flex-1">
                  <label className="text-[10px] text-muted-foreground mb-1 block">Fim</label>
                  <input
                    ref={toRef}
                    type="text"
                    value={toInput}
                    onChange={(e) => setToInput(e.target.value)}
                    onBlur={handleToInputBlur}
                    placeholder="dd/mm/aaaa"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border/50 bg-background/50 backdrop-blur-sm focus:outline-none focus:ring-1 focus:ring-primary/30 text-foreground"
                  />
                </div>
              </div>

              {/* Range calendar */}
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={selectedRange?.from}
                selected={selectedRange}
                onSelect={handleRangeSelect}
                numberOfMonths={2}
                locale={ptBR}
                className="p-2 pointer-events-auto text-xs"
              />

              {/* Footer */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/20">
                <div className="text-[11px] text-muted-foreground">
                  {hasValidCustomRange ? (
                    <span>
                      {format(selectedRange!.from!, "dd MMM yyyy", { locale: ptBR })}
                      {" → "}
                      {format(selectedRange!.to!, "dd MMM yyyy", { locale: ptBR })}
                    </span>
                  ) : (
                    <span className="italic">Selecione início e fim</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setOpen(false)} className="text-xs h-7">
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleApplyCustom}
                    disabled={!hasValidCustomRange}
                    className="text-xs h-7"
                  >
                    Aplicar
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
