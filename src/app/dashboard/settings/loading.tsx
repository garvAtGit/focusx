import { Skeleton } from "@/components/ui/skeleton"

export default function SettingsLoading() {
  return (
    <div className="w-full space-y-8 max-w-4xl">
      <div className="space-y-2">
        <Skeleton className="h-10 w-48 bg-muted" />
        <Skeleton className="h-4 w-64 bg-muted/50" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-8">
        <div className="flex flex-col space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-10 w-full bg-muted/30 rounded-md" />
          ))}
        </div>
        
        <div className="space-y-6">
          <div className="p-6 rounded-2xl border border-border bg-card space-y-6">
            <Skeleton className="h-8 w-48 bg-muted" />
            <Skeleton className="h-4 w-64 bg-muted/50" />
            
            <div className="space-y-4 pt-4 border-t border-border">
              <div className="space-y-2">
                <Skeleton className="h-4 w-32 bg-muted" />
                <Skeleton className="h-10 w-full bg-muted/50" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24 bg-muted" />
                <Skeleton className="h-10 w-full bg-muted/50" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-40 bg-muted" />
                <Skeleton className="h-24 w-full bg-muted/50" />
              </div>
              <Skeleton className="h-10 w-32 bg-muted mt-6" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
