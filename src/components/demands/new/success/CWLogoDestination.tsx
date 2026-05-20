import logoCw from "@/assets/logo-cw-pj.png";
import { motion, useReducedMotion } from "framer-motion";

interface Props {
  arrived: boolean;
}

export function CWLogoDestination({ arrived }: Props) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { scale: 0.9, opacity: 0.7 }}
      animate={
        reduce
          ? undefined
          : arrived
          ? { scale: [1, 1.08, 1], opacity: 1 }
          : { scale: 1, opacity: 0.85 }
      }
      transition={
        reduce
          ? undefined
          : arrived
          ? { type: "spring", stiffness: 220, damping: 18 }
          : { duration: 0.3 }
      }
      className="relative inline-flex items-center justify-center"
    >
      {/* Glow */}
      <div className="absolute inset-0 -m-6 rounded-full bg-gradient-to-br from-blue-400/35 via-emerald-400/25 to-transparent blur-2xl pointer-events-none" />
      {/* Disco glass */}
      <div className="relative h-24 w-24 md:h-28 md:w-28 rounded-full bg-white/85 backdrop-blur-xl border border-white/70 shadow-[0_18px_50px_-12px_rgba(15,23,42,0.28),inset_0_1px_0_rgba(255,255,255,0.9)] flex items-center justify-center overflow-hidden">
        <img src={logoCw} alt="CW Finanças" className="h-16 w-16 md:h-20 md:w-20 object-contain" />
      </div>
      {arrived && !reduce && (
        <motion.div
          initial={{ scale: 0.6, opacity: 0.6 }}
          animate={{ scale: 1.8, opacity: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="absolute inset-0 -m-2 rounded-full ring-2 ring-emerald-400/50 pointer-events-none"
        />
      )}
    </motion.div>
  );
}
