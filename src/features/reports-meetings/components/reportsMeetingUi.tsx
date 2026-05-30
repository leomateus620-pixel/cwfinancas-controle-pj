import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function GlassPanel({
  children,
  className,
  featured = false,
  id,
}: {
  children: ReactNode;
  className?: string;
  featured?: boolean;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "group relative overflow-hidden rounded-[1.35rem] border border-white/65 bg-white/[0.72] p-4 text-slate-900 shadow-[0_18px_48px_-32px_rgba(15,23,42,0.42),0_1px_0_rgba(255,255,255,0.75)_inset] backdrop-blur-2xl transition-[transform,box-shadow,border-color,background-color] duration-300 ease-out hover:-translate-y-0.5 hover:border-slate-200/90 hover:bg-white/[0.78] hover:shadow-[0_26px_68px_-38px_rgba(15,23,42,0.52),0_1px_0_rgba(255,255,255,0.9)_inset] active:scale-[0.995] md:p-5",
        featured &&
          "border-emerald-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.88),rgba(236,253,245,0.58)_48%,rgba(239,246,255,0.52))] shadow-[0_30px_90px_-46px_rgba(16,185,129,0.62),0_18px_58px_-44px_rgba(37,99,235,0.55),0_1px_0_rgba(255,255,255,0.95)_inset] before:absolute before:inset-x-8 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-emerald-400/55 before:to-transparent after:pointer-events-none after:absolute after:-right-24 after:-top-24 after:h-56 after:w-56 after:rounded-full after:bg-emerald-300/16 after:blur-3xl",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function StatusBadge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
  className?: string;
}) {
  const tones = {
    neutral: "border-slate-200/90 bg-slate-50/90 text-slate-700",
    success: "border-emerald-200/90 bg-emerald-50/95 text-emerald-800",
    warning: "border-amber-200/90 bg-amber-50/95 text-amber-800",
    danger: "border-rose-200/90 bg-rose-50/95 text-rose-800",
    info: "border-blue-200/90 bg-blue-50/95 text-blue-800",
  };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none shadow-[0_6px_18px_-14px_rgba(15,23,42,0.5)] backdrop-blur-md",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  tone = "neutral",
  icon,
  className,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
  icon?: ReactNode;
  className?: string;
}) {
  const tones = {
    neutral: "from-slate-50/95 via-white/82 to-white/68 text-slate-700",
    success: "from-emerald-50/95 via-white/82 to-white/68 text-emerald-800",
    warning: "from-amber-50/95 via-white/82 to-white/68 text-amber-800",
    danger: "from-rose-50/95 via-white/82 to-white/68 text-rose-800",
    info: "from-blue-50/95 via-white/82 to-white/68 text-blue-800",
  };

  return (
    <div
      className={cn(
        "min-h-[118px] rounded-2xl border border-white/75 bg-gradient-to-br p-4 shadow-[0_14px_34px_-24px_rgba(15,23,42,0.58),0_1px_0_rgba(255,255,255,0.88)_inset] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-slate-200/90 hover:shadow-[0_20px_46px_-28px_rgba(15,23,42,0.68),0_1px_0_rgba(255,255,255,0.95)_inset] active:scale-[0.985]",
        tones[tone],
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase leading-4 tracking-[0.16em] text-slate-500">{label}</p>
        {icon && <div className="rounded-full bg-white/65 p-1.5 text-current opacity-80 shadow-sm">{icon}</div>}
      </div>
      <div className="mt-3 break-words text-2xl font-bold tracking-tight text-slate-950 tabular-nums sm:text-[1.6rem]">
        {value}
      </div>
      {detail && <div className="mt-1.5 text-xs font-medium leading-relaxed text-slate-500">{detail}</div>}
    </div>
  );
}
