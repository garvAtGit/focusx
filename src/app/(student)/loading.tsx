export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Search Header Skeleton */}
      <div className="border-b border-border bg-card sticky top-16 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="h-8 bg-muted animate-pulse rounded-lg w-64"></div>
              <div className="h-4 bg-muted animate-pulse rounded-lg w-48"></div>
            </div>
            <div className="w-full md:w-[400px] lg:w-[500px]">
              <div className="h-14 bg-muted animate-pulse rounded-full w-full"></div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div className="h-6 bg-muted animate-pulse rounded w-32"></div>
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 w-24 bg-muted animate-pulse rounded-full"></div>
            ))}
          </div>
        </div>

        {/* Library Cards Skeleton Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="space-y-4">
              <div className="aspect-square bg-muted animate-pulse rounded-2xl w-full"></div>
              <div className="space-y-2">
                <div className="h-5 bg-muted animate-pulse rounded w-3/4"></div>
                <div className="h-4 bg-muted animate-pulse rounded w-1/2"></div>
                <div className="h-4 bg-muted animate-pulse rounded w-1/4"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
