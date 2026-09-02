import { Skeleton } from "@/components/ui/skeleton"

export default function SeatsLoading() {
  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div className="space-y-2">
          <Skeleton className="h-10 w-48 bg-muted" />
          <Skeleton className="h-4 w-64 bg-muted/50" />
        </div>
        <div className="flex gap-4">
          <Skeleton className="h-10 w-24 bg-muted rounded-md" />
          <Skeleton className="h-10 w-24 bg-muted rounded-md" />
        </div>
      </div>

      <div className="p-8 rounded-2xl border border-border bg-card shadow-sm">
        <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-3 sm:gap-4">
          {Array.from({ length: 60 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-lg bg-muted/50" />
          ))}
        </div>
      </div>
    </div>
  )
}
