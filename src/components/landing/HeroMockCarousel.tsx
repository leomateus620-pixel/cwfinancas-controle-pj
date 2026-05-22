import { useEffect, useRef, useState, useCallback } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { MockDemandCard } from "./MockDemandCard";
import { MockDashboardCard } from "./MockDashboardCard";

const AUTOPLAY_MS = 6500;

export function HeroMockCarousel() {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: "center",
    containScroll: false,
    duration: 32,
    startIndex: 0,
  });
  const [selected, setSelected] = useState(0);
  const [isPaused, setPaused] = useState(false);
  const timerRef = useRef<number | null>(null);
  const reducedMotion = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    reducedMotion.current =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  }, []);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelected(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    onSelect();
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi]);

  // Autoplay
  useEffect(() => {
    if (!emblaApi) return;
    if (reducedMotion.current) return;

    const clear = () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    const start = () => {
      clear();
      if (isPaused || document.hidden) return;
      timerRef.current = window.setInterval(() => {
        emblaApi.scrollNext();
      }, AUTOPLAY_MS);
    };

    start();

    const onVis = () => {
      if (document.hidden) clear();
      else start();
    };
    const onPointerDown = () => {
      clear();
    };
    const onSettle = () => {
      start();
    };

    document.addEventListener("visibilitychange", onVis);
    emblaApi.on("pointerDown", onPointerDown);
    emblaApi.on("settle", onSettle);

    return () => {
      clear();
      document.removeEventListener("visibilitychange", onVis);
      emblaApi.off("pointerDown", onPointerDown);
      emblaApi.off("settle", onSettle);
    };
  }, [emblaApi, isPaused]);

  const goTo = useCallback(
    (i: number) => emblaApi?.scrollTo(i),
    [emblaApi],
  );

  const slides = [
    { key: "demand", label: "Demanda Inteligente", node: <MockDemandCard /> },
    { key: "dashboard", label: "Dashboard Financeiro", node: <MockDashboardCard /> },
  ];

  // Per-slide tint palette (HSL stops)
  const palette = selected === 0
    ? { a: "199 89% 55%", b: "173 80% 45%", c: "221 85% 53%" } // demand: teal/primary
    : { a: "221 85% 53%", b: "262 83% 58%", c: "199 89% 48%" }; // dashboard: primary/violet

  return (
    <div
      className="relative opacity-0 animate-fade-in-up hidden lg:block"
      style={{
        animationDelay: "400ms",
        animationFillMode: "forwards",
        perspective: "1400px",
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      role="region"
      aria-roledescription="carousel"
      aria-label="Prévia do produto"
    >
      {/* ── Subtle ambient glow ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
      >
        {/* Soft halo behind card */}
        <div
          className="absolute inset-8 rounded-[40px] transition-opacity duration-700"
          style={{
            background: `radial-gradient(ellipse at 50% 50%, hsl(${palette.a} / 0.18), hsl(${palette.c} / 0.10) 50%, transparent 75%)`,
            filter: "blur(80px)",
            willChange: "opacity",
          }}
        />

        {/* Contact shadow (ground anchor) */}
        <div
          className="absolute left-[14%] right-[14%] -bottom-1 h-2 rounded-full"
          style={{
            background: "hsl(220 30% 8% / 0.25)",
            filter: "blur(14px)",
          }}
        />
      </div>

      {/* Embla viewport */}
      <div ref={emblaRef} className="overflow-hidden relative">
        <div className="flex">
          {slides.map((s) => (
            <div
              key={s.key}
              className="min-w-0 shrink-0 grow-0 basis-full"
              aria-roledescription="slide"
              aria-label={s.label}
            >
              <div className="mx-auto max-w-[560px]">
                {s.node}
              </div>
            </div>
          ))}
        </div>

        {/* D — Specular highlight (top arc of the glass) */}
        <div
          className="absolute top-0 left-[10%] right-[10%] h-px pointer-events-none"
          style={{
            background:
              "linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.55), transparent)",
          }}
        />
      </div>

      {/* Dots */}
      <div className="flex items-center justify-center gap-2 mt-5">
        {slides.map((s, i) => {
          const isActive = i === selected;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => goTo(i)}
              className="group/dot transition-all duration-300 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              style={{
                width: isActive ? 28 : 8,
                height: 8,
                background: isActive
                  ? "linear-gradient(90deg, hsl(221 85% 53%), hsl(199 89% 48%))"
                  : "hsl(var(--muted-foreground) / 0.25)",
                boxShadow: isActive
                  ? "0 4px 12px -2px hsl(221 85% 53% / 0.5)"
                  : "none",
              }}
              aria-label={`Ver ${s.label}`}
              aria-current={isActive ? "true" : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}
