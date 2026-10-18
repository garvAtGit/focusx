export default function Loading() {
  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header Skeleton */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-8">
        <div className="h-4 bg-muted animate-pulse rounded w-48 mb-4"></div>
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="h-10 bg-muted animate-pulse rounded w-64"></div>
            <div className="flex gap-3">
              <div className="h-5 bg-muted animate-pulse rounded w-24"></div>
              <div className="h-5 bg-muted animate-pulse rounded w-32"></div>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="h-10 w-24 bg-muted animate-pulse rounded-lg"></div>
            <div className="h-10 w-24 bg-muted animate-pulse rounded-lg"></div>
          </div>
        </div>
      </div>

      {/* Top Full Width Photos Skeleton */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 mt-8">
        <div className="w-full h-[50vh] md:h-[60vh] bg-muted animate-pulse rounded-3xl"></div>
      </div>

      {/* Main Grid Skeleton */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 mt-8 flex flex-col lg:grid lg:grid-cols-3 gap-y-12 lg:gap-x-12">
        
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-12">
          {/* About */}
          <section className="space-y-4">
            <div className="h-8 bg-muted animate-pulse rounded w-32"></div>
            <div className="h-16 bg-muted animate-pulse rounded-xl w-full"></div>
            <div className="space-y-2 mt-4">
              <div className="h-4 bg-muted animate-pulse rounded w-full"></div>
              <div className="h-4 bg-muted animate-pulse rounded w-full"></div>
              <div className="h-4 bg-muted animate-pulse rounded w-3/4"></div>
            </div>
          </section>

          <hr className="border-border hidden lg:block" />

          {/* Facilities */}
          <section className="space-y-6">
            <div className="h-8 bg-muted animate-pulse rounded w-48"></div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-5 bg-muted animate-pulse rounded w-full"></div>
              ))}
            </div>
          </section>
          
          <hr className="border-border hidden lg:block" />

          {/* Map */}
          <section className="space-y-6">
            <div className="h-8 bg-muted animate-pulse rounded w-32"></div>
            <div className="h-[350px] bg-muted animate-pulse rounded-2xl w-full"></div>
          </section>
        </div>

        {/* Right Column: Sticky Widget Skeleton */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-8 bg-card border border-border rounded-3xl p-6 space-y-6">
            <div className="h-8 bg-muted animate-pulse rounded w-32"></div>
            <div className="space-y-4">
              <div className="h-10 bg-muted animate-pulse rounded-full w-full"></div>
              <div className="h-24 bg-muted animate-pulse rounded-2xl w-full"></div>
              <div className="h-24 bg-muted animate-pulse rounded-2xl w-full"></div>
            </div>
            <div className="h-[200px] bg-muted animate-pulse rounded-2xl w-full mt-4"></div>
            <div className="h-14 bg-muted animate-pulse rounded-xl w-full mt-4"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
