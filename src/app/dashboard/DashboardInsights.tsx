import { AlertCircle, Zap, Info } from "lucide-react"

interface Insight {
  id: string;
  type: 'warning' | 'opportunity' | 'info';
  title: string;
  description: string;
}

export function DashboardInsights({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) {
    return (
      <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
        <h2 className="text-xl font-bold font-heading mb-4">Actionable Insights</h2>
        <p className="text-sm text-muted-foreground">Everything looks perfectly optimized right now.</p>
      </div>
    )
  }

  return (
    <div className="bg-card p-6 rounded-2xl border border-border shadow-sm flex flex-col h-full">
      <h2 className="text-xl font-bold font-heading mb-4">Actionable Insights</h2>
      <div className="space-y-4 flex-1 overflow-y-auto pr-2">
        {insights.map((insight) => (
          <div key={insight.id} className="flex gap-4 p-4 rounded-xl bg-muted/30 border">
            <div className={`p-2 rounded-full h-fit ${
              insight.type === 'warning' ? 'bg-destructive/10 text-destructive' :
              insight.type === 'opportunity' ? 'bg-success/10 text-success' :
              'bg-primary/10 text-primary'
            }`}>
              {insight.type === 'warning' && <AlertCircle className="w-5 h-5" />}
              {insight.type === 'opportunity' && <Zap className="w-5 h-5" />}
              {insight.type === 'info' && <Info className="w-5 h-5" />}
            </div>
            <div>
              <h4 className="font-semibold text-sm text-foreground mb-1">{insight.title}</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">{insight.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
