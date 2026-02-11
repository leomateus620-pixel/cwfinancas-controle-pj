export function HomeSkeletonLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-72 rounded-lg bg-white/5 animate-pulse" />
        <div className="h-4 w-96 rounded-lg bg-white/[0.03] animate-pulse" />
      </div>

      {/* KPI grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className={`liquid-glass p-6 space-y-3 ${i === 0 ? "md:col-span-2" : ""}`}
            style={{ opacity: 0.6 }}
          >
            <div className="w-10 h-10 rounded-xl bg-white/5 animate-pulse" />
            <div className="h-3 w-20 rounded bg-white/5 animate-pulse" />
            <div className="h-8 w-32 rounded bg-white/[0.03] animate-pulse" />
          </div>
        ))}
      </div>

      {/* Bottom skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[0, 1, 2].map(i => (
          <div key={i} className="liquid-glass p-6 h-52 animate-pulse" style={{ opacity: 0.4 }} />
        ))}
      </div>
    </div>
  );
}
