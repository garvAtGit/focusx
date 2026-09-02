import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardLoading() {
  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div className="space-y-2">
          <Skeleton className="h-10 w-48 bg-muted" />
          <Skeleton className="h-4 w-64 bg-muted/50" />
        </div>
        <Skeleton className="h-10 w-32 bg-muted hidden sm:block" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4">
            <div className="flex justify-between items-start">
              <Skeleton className="h-4 w-24 bg-muted/50" />
              <Skeleton className="h-8 w-8 rounded-full bg-muted/30" />
            </div>
            <Skeleton className="h-8 w-16 bg-muted" />
            <Skeleton className="h-3 w-32 bg-muted/40" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-2 p-6 rounded-2xl border border-border bg-card shadow-sm space-y-6 h-[400px]">
          <Skeleton className="h-6 w-48 bg-muted/60" />
          <div className="space-y-4 mt-8">
            <Skeleton className="h-12 w-full bg-muted/30" />
            <Skeleton className="h-12 w-full bg-muted/30" />
            <Skeleton className="h-12 w-full bg-muted/30" />
            <Skeleton className="h-12 w-full bg-muted/30" />
          </div>
        </div>
        <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-6 h-[400px]">
          <Skeleton className="h-6 w-32 bg-muted/60" />
          <div className="space-y-4 mt-8">
            <div className="flex gap-4">
              <Skeleton className="h-10 w-10 rounded-full bg-muted/40" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-3/4 bg-muted/50" />
                <Skeleton className="h-3 w-1/2 bg-muted/30" />
              </div>
            </div>
            <div className="flex gap-4">
              <Skeleton className="h-10 w-10 rounded-full bg-muted/40" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-2/3 bg-muted/50" />
                <Skeleton className="h-3 w-1/3 bg-muted/30" />
              </div>
            </div>
            <div className="flex gap-4">
              <Skeleton className="h-10 w-10 rounded-full bg-muted/40" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-3/4 bg-muted/50" />
                <Skeleton className="h-3 w-1/2 bg-muted/30" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
