import { Skeleton } from "@/components/ui/skeleton"

export default function TableLoading() {
  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div className="space-y-2">
          <Skeleton className="h-10 w-48 bg-muted" />
          <Skeleton className="h-4 w-64 bg-muted/50" />
        </div>
        <Skeleton className="h-10 w-32 bg-muted rounded-md" />
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="p-4 border-b border-border flex items-center justify-between gap-4">
          <Skeleton className="h-10 w-64 bg-muted" />
          <Skeleton className="h-10 w-32 bg-muted" />
        </div>
        <div className="p-4 space-y-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center justify-between space-x-4">
              <Skeleton className="h-12 w-full bg-muted/30" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
