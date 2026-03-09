import { Skeleton } from "@/components/ui/skeleton";

export function InsightsSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header skeleton */}
      <div className="liquid-glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Skeleton className="w-11 h-11 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-64" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-7 w-28 rounded-full" />
          <Skeleton className="h-7 w-24 rounded-full" />
          <Skeleton className="h-7 w-32 rounded-full" />
        </div>
      </div>

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="liquid-glass-card p-5 space-y-3">
            <div className="flex items-start justify-between">
              <Skeleton className="w-10 h-10 rounded-xl" />
              <Skeleton className="h-4 w-12 rounded-full" />
            </div>
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
            <div className="flex gap-3">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
