import { cn } from "@/lib/utils";

interface ChartSkeletonProps {
  type?: "area" | "bar" | "pie" | "line";
  height?: string;
  className?: string;
}

export function ChartSkeleton({
  type = "area",
  height = "h-[300px]",
  className,
}: ChartSkeletonProps) {
  if (type === "pie") {
    return (
      <div className={cn("flex items-center justify-center", height, className)}>
        <div className="relative">
          <div className="w-40 h-40 rounded-full border-[20px] border-muted animate-pulse" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-4 bg-muted rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (type === "bar") {
    return (
      <div className={cn("flex items-end justify-around gap-4 px-8 pb-8", height, className)}>
        {[65, 85, 45, 90, 70, 55].map((h, i) => (
          <div
            key={i}
            className="flex-1 bg-muted rounded-t-lg animate-pulse"
            style={{ 
              height: `${h}%`,
              animationDelay: `${i * 100}ms`
            }}
          />
        ))}
      </div>
    );
  }

  // Area/Line chart skeleton
  return (
    <div className={cn("relative overflow-hidden", height, className)}>
      {/* Grid lines */}
      <div className="absolute inset-0 flex flex-col justify-between py-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-px bg-border/50" />
        ))}
      </div>
      
      {/* Animated wave */}
      <div className="absolute inset-0 flex items-end px-4 pb-4">
        <div className="relative w-full h-3/4">
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 400 150"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="skeletonGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--muted))" stopOpacity="0.5" />
                <stop offset="100%" stopColor="hsl(var(--muted))" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0,150 L0,80 C50,60 100,90 150,70 C200,50 250,80 300,60 C350,40 380,70 400,50 L400,150 Z"
              fill="url(#skeletonGradient)"
              className="animate-pulse"
            />
            <path
              d="M0,80 C50,60 100,90 150,70 C200,50 250,80 300,60 C350,40 380,70 400,50"
              fill="none"
              stroke="hsl(var(--muted-foreground) / 0.2)"
              strokeWidth="2"
              className="animate-pulse"
            />
          </svg>
        </div>
      </div>

      {/* Shimmer overlay */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0 -translate-x-full animate-shimmer"
          style={{
            background: "linear-gradient(90deg, transparent 0%, hsl(var(--primary) / 0.05) 50%, transparent 100%)",
          }}
        />
      </div>
    </div>
  );
}
