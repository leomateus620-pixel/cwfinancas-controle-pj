import logoCw from "@/assets/logo-cw-pj.png";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

interface Props {
  arrived: boolean;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

const SIZES = {
  sm: { outer: "h-20 w-20", disc: "h-16 w-16", logo: "h-10 w-10", halo: "-m-3" },
  md: { outer: "h-24 w-24 md:h-28 md:w-28", disc: "h-20 w-20 md:h-24 md:w-24", logo: "h-14 w-14 md:h-16 md:w-16", halo: "-m-4" },
  lg: { outer: "h-28 w-28 md:h-32 md:w-32", disc: "h-24 w-24 md:h-28 md:w-28", logo: "h-16 w-16 md:h-20 md:w-20", halo: "-m-5" },
};

/**
 * Núcleo CW — destino premium do fluxo.
 * Composição: halo radial, conic-gradient ring lento, orbe duplo,
 * sombra projetada no "chão" do canal.
 */
export function CWLogoDestination({ arrived, size = "md", showLabel = false, className }: Props) {
  const reduce = useReducedMotion();
  const s = SIZES[size];

  return (
    <div className={cn("relative inline-flex flex-col items-center", className)}>
      {/* Sombra no chão */}
      <div
        aria-hidden
        className="absolute left-1/2 -translate-x-1/2 bottom-[-10px] h-3 w-16 rounded-full bg-foreground/25 blur-md pointer-events-none"
        style={{ opacity: 0.35 }}
      />

      <motion.div
        initial={reduce ? false : { scale: 0.92, opacity: 0.85 }}
        animate={
          reduce
            ? undefined
            : arrived
            ? { scale: [1, 1.08, 1], opacity: 1 }
            : { scale: 1, opacity: 0.95 }
        }
        transition={
          reduce
            ? undefined
            : arrived
            ? { type: "spring", stiffness: 240, damping: 16 }
            : { duration: 0.4 }
        }
        className={cn("relative inline-flex items-center justify-center", s.outer)}
      >
        {/* Halo externo radial (azul → esmeralda) */}
        <div
          aria-hidden
          className={cn(
            "absolute inset-0 rounded-full pointer-events-none transition-opacity duration-500",
            s.halo,
            arrived ? "opacity-100" : "opacity-65",
          )}
          style={{
            background:
              "radial-gradient(circle, rgba(59,130,246,0.35), rgba(16,185,129,0.22) 50%, transparent 75%)",
            filter: "blur(14px)",
          }}
        />

        {/* Anel conic-gradient rotativo (borda viva premium) */}
        {!reduce && (
          <motion.div
            aria-hidden
            animate={{ rotate: 360 }}
            transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background:
                "conic-gradient(from 0deg, rgba(59,130,246,0.55), rgba(125,211,252,0.0) 25%, rgba(16,185,129,0.5) 50%, rgba(125,211,252,0.0) 75%, rgba(59,130,246,0.55) 100%)",
              maskImage: "radial-gradient(circle, transparent 60%, black 62%, black 70%, transparent 72%)",
              WebkitMaskImage:
                "radial-gradient(circle, transparent 60%, black 62%, black 70%, transparent 72%)",
              opacity: 0.7,
            }}
          />
        )}

        {/* Disco glass principal */}
        <div
          className={cn(
            "relative rounded-full bg-white/90 backdrop-blur-xl border border-white/85 flex items-center justify-center overflow-hidden",
            s.disc,
          )}
          style={{
            boxShadow:
              "0 22px 55px -14px rgba(15,23,42,0.32), inset 0 1px 0 rgba(255,255,255,0.95), inset 0 -4px 10px rgba(15,23,42,0.07)",
          }}
        >
          <img src={logoCw} alt="CW Finanças" className={cn("object-contain", s.logo)} />
        </div>

        {/* Ring expansivo na chegada */}
        {arrived && !reduce && (
          <motion.div
            aria-hidden
            initial={{ scale: 0.7, opacity: 0.65 }}
            animate={{ scale: 1.85, opacity: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="absolute inset-0 -m-1.5 rounded-full ring-2 ring-emerald-400/60 pointer-events-none"
          />
        )}
      </motion.div>

      {showLabel && (
        <span className="mt-2 text-[10.5px] font-semibold tracking-[0.14em] uppercase text-foreground/75">
          CW Finanças
        </span>
      )}
    </div>
  );
}
