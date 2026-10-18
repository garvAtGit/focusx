import { Skeleton } from "@/components/ui/skeleton"

export default function PlansLoading() {
  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div className="space-y-2">
          <Skeleton className="h-10 w-48 bg-muted" />
          <Skeleton className="h-4 w-64 bg-muted/50" />
        </div>
        <Skeleton className="h-10 w-32 bg-muted rounded-md" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-6 rounded-2xl border border-border bg-card space-y-6">
            <Skeleton className="h-8 w-2/3 bg-muted/80" />
            <Skeleton className="h-12 w-32 bg-muted" />
            <div className="space-y-3">
              {[1, 2, 3, 4].map((j) => (
                <div key={j} className="flex items-center gap-3">
                  <Skeleton className="h-5 w-5 rounded-full bg-muted/50" />
                  <Skeleton className="h-4 w-full bg-muted/40" />
                </div>
              ))}
            </div>
            <Skeleton className="h-10 w-full bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}
