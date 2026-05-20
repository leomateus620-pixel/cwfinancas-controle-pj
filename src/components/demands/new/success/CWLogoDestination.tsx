import logoCw from "@/assets/logo-cw-pj.png";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

interface Props {
  arrived: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: { disc: "h-16 w-16", logo: "h-11 w-11", glow: "-m-4" },
  md: { disc: "h-20 w-20 md:h-24 md:w-24", logo: "h-14 w-14 md:h-16 md:w-16", glow: "-m-5" },
  lg: { disc: "h-24 w-24 md:h-28 md:w-28", logo: "h-16 w-16 md:h-20 md:w-20", glow: "-m-6" },
};

export function CWLogoDestination({ arrived, size = "md", className }: Props) {
  const reduce = useReducedMotion();
  const s = SIZES[size];

  return (
    <motion.div
      initial={reduce ? false : { scale: 0.9, opacity: 0.7 }}
      animate={
        reduce
          ? undefined
          : arrived
          ? { scale: [1, 1.1, 1], opacity: 1 }
          : { scale: 1, opacity: 0.9 }
      }
      transition={
        reduce
          ? undefined
          : arrived
          ? { type: "spring", stiffness: 240, damping: 16 }
          : { duration: 0.3 }
      }
      className={cn("relative inline-flex items-center justify-center", className)}
    >
      {/* Halo glow */}
      <div
        className={cn(
          "absolute inset-0 rounded-full bg-gradient-to-br from-blue-400/40 via-emerald-400/30 to-transparent blur-2xl pointer-events-none transition-opacity duration-500",
          s.glow,
          arrived ? "opacity-100" : "opacity-60",
        )}
      />
      {/* Disco glass */}
      <div
        className={cn(
          "relative rounded-full bg-white/85 backdrop-blur-xl border border-white/80 flex items-center justify-center overflow-hidden",
          s.disc,
        )}
        style={{
          boxShadow:
            "0 18px 50px -12px rgba(15,23,42,0.28), inset 0 1px 0 rgba(255,255,255,0.95), inset 0 -3px 8px rgba(15,23,42,0.06)",
        }}
      >
        <img src={logoCw} alt="CW Finanças" className={cn("object-contain", s.logo)} />
      </div>
      {arrived && !reduce && (
        <motion.div
          initial={{ scale: 0.6, opacity: 0.55 }}
          animate={{ scale: 1.7, opacity: 0 }}
          transition={{ duration: 0.95, ease: "easeOut" }}
          className="absolute inset-0 -m-1.5 rounded-full ring-2 ring-emerald-400/55 pointer-events-none"
        />
      )}
    </motion.div>
  );
}
