import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { subDays, subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear, format, parseISO, isValid } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface DateRange {
  from: Date;
  to: Date;
}

export interface DateRangeContextType {
  range: DateRange;
  preset: string | null;
  setPreset: (preset: string) => void;
  setCustomRange: (from: Date, to: Date) => void;
  reset: () => void;
  monthRange: { from: string; to: string };
  rangeLabel: string;
  formattedRange: string;
}

const PRESETS: Record<string, () => DateRange> = {
  "7d": () => ({ from: subDays(new Date(), 7), to: new Date() }),
  "30d": () => ({ from: subDays(new Date(), 30), to: new Date() }),
  "3m": () => ({ from: subMonths(new Date(), 3), to: new Date() }),
  "6m": () => ({ from: subMonths(new Date(), 6), to: new Date() }),
  "12m": () => ({ from: subMonths(new Date(), 12), to: new Date() }),
  "month": () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }),
  "year": () => ({ from: startOfYear(new Date()), to: endOfYear(new Date()) }),
};

const PRESET_LABELS: Record<string, string> = {
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  "3m": "Últimos 3 meses",
  "6m": "Últimos 6 meses",
  "12m": "Últimos 12 meses",
  "month": "Mês atual",
  "year": "Ano atual",
  "custom": "Personalizado",
};

const DEFAULT_PRESET = "6m";

const DateRangeContext = createContext<DateRangeContextType | null>(null);

export function DateRangeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [range, setRange] = useState<DateRange>(PRESETS[DEFAULT_PRESET]());
  const [preset, setPresetState] = useState<string | null>(DEFAULT_PRESET);
  const [initialized, setInitialized] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Initialize from URL > Supabase > default
  useEffect(() => {
    if (initialized) return;

    const urlFrom = searchParams.get("from");
    const urlTo = searchParams.get("to");
    const urlPreset = searchParams.get("preset");

    if (urlFrom && urlTo) {
      const from = parseISO(urlFrom);
      const to = parseISO(urlTo);
      if (isValid(from) && isValid(to)) {
        setRange({ from, to });
        setPresetState(urlPreset || "custom");
        setInitialized(true);
        return;
      }
    }

    // Try loading from Supabase preferences
    if (user?.id) {
      supabase
        .from("profiles")
        .select("preferences")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data, error }) => {
          if (!error && data) {
            const prefs = data?.preferences as Record<string, unknown> | null;
            const dateRange = prefs?.dateRange as { preset?: string; from?: string; to?: string } | undefined;
            if (dateRange?.preset && PRESETS[dateRange.preset]) {
              setRange(PRESETS[dateRange.preset]());
              setPresetState(dateRange.preset);
            } else if (dateRange?.from && dateRange?.to) {
              const from = parseISO(dateRange.from);
              const to = parseISO(dateRange.to);
              if (isValid(from) && isValid(to)) {
                setRange({ from, to });
                setPresetState("custom");
              }
            }
          }
          setInitialized(true);
        });
    } else {
      setInitialized(true);
    }
  }, [user?.id, initialized, searchParams]);

  // Sync to URL
  useEffect(() => {
    if (!initialized) return;
    const newParams = new URLSearchParams(searchParams);
    newParams.set("from", format(range.from, "yyyy-MM-dd"));
    newParams.set("to", format(range.to, "yyyy-MM-dd"));
    if (preset) newParams.set("preset", preset);
    else newParams.delete("preset");
    setSearchParams(newParams, { replace: true });
  }, [range, preset, initialized]);

  // Persist to Supabase (debounced)
  const persistToSupabase = useCallback((r: DateRange, p: string | null) => {
    if (!user?.id) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("preferences")
          .eq("id", user.id)
          .maybeSingle();
        
        const existing = (profile?.preferences as Record<string, unknown>) || {};
        await supabase
          .from("profiles")
          .update({
            preferences: {
              ...existing,
              dateRange: {
                preset: p,
                from: format(r.from, "yyyy-MM-dd"),
                to: format(r.to, "yyyy-MM-dd"),
              },
            },
          })
          .eq("id", user.id);
      } catch (e) {
        console.error("Failed to persist date range:", e);
      }
    }, 1000);
  }, [user?.id]);

  const setPreset = useCallback((key: string) => {
    const factory = PRESETS[key];
    if (!factory) return;
    const newRange = factory();
    setRange(newRange);
    setPresetState(key);
    persistToSupabase(newRange, key);
  }, [persistToSupabase]);

  const setCustomRange = useCallback((from: Date, to: Date) => {
    const newRange = { from, to };
    setRange(newRange);
    setPresetState("custom");
    persistToSupabase(newRange, "custom");
  }, [persistToSupabase]);

  const reset = useCallback(() => {
    setPreset(DEFAULT_PRESET);
  }, [setPreset]);

  const monthRange = useMemo(() => ({
    from: format(range.from, "yyyy-MM"),
    to: format(range.to, "yyyy-MM"),
  }), [range]);

  const rangeLabel = useMemo(() => {
    if (preset && PRESET_LABELS[preset]) return PRESET_LABELS[preset];
    return "Personalizado";
  }, [preset]);

  const formattedRange = useMemo(() => {
    return `${format(range.from, "dd/MM/yyyy")} – ${format(range.to, "dd/MM/yyyy")}`;
  }, [range]);

  const value = useMemo(() => ({
    range,
    preset,
    setPreset,
    setCustomRange,
    reset,
    monthRange,
    rangeLabel,
    formattedRange,
  }), [range, preset, setPreset, setCustomRange, reset, monthRange, rangeLabel, formattedRange]);

  return (
    <DateRangeContext.Provider value={value}>
      {children}
    </DateRangeContext.Provider>
  );
}

export function useDateRange(): DateRangeContextType {
  const ctx = useContext(DateRangeContext);
  if (!ctx) throw new Error("useDateRange must be used within DateRangeProvider");
  return ctx;
}
