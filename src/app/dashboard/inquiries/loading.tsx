import { Skeleton } from "@/components/ui/skeleton"

export default function InquiriesLoading() {
  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div className="space-y-2">
          <Skeleton className="h-10 w-48 bg-muted" />
          <Skeleton className="h-4 w-64 bg-muted/50" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-10 bg-muted rounded-md" />
          <Skeleton className="h-10 w-32 bg-muted rounded-md" />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <Skeleton className="h-10 w-full sm:w-64 bg-muted" />
          <Skeleton className="h-10 w-full sm:w-32 bg-muted" />
        </div>
        <div className="p-4 space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex flex-col space-y-3 p-4 border border-border rounded-lg bg-background/50">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-40 bg-muted" />
                  <Skeleton className="h-4 w-24 bg-muted/50" />
                </div>
                <Skeleton className="h-6 w-20 bg-muted rounded-full" />
              </div>
              <Skeleton className="h-16 w-full bg-muted/30" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-24 bg-muted rounded-md" />
                <Skeleton className="h-8 w-24 bg-muted rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
