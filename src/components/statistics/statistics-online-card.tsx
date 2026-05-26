import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { StatisticsKpis } from "@/lib/statistics/statistics-types"

export function StatisticsOnlineCard({
  title,
  subtitle,
  kpis,
  labels,
}: {
  title: string
  subtitle: string
  kpis: StatisticsKpis
  labels: {
    online: string
    manual: string
    percentOnline: string
  }
}) {
  const total = Math.max(1, kpis.onlineBookings + kpis.manualBookings)
  const onlineWidth = (kpis.onlineBookings / total) * 100

  return (
    <Card className="rounded-3xl border-border/80 bg-card/95 shadow-sm shadow-slate-900/5">
      <CardHeader className="px-5">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-4xl font-semibold tracking-tight text-foreground tabular-nums">
              {kpis.onlinePercent}%
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{labels.percentOnline}</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-medium text-foreground">{kpis.onlineBookings}</p>
            <p className="text-muted-foreground">{labels.online}</p>
          </div>
        </div>
        <div className="mt-5 h-3 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${onlineWidth}%` }} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border/70 bg-muted/15 px-3 py-3">
            <p className="text-xs text-muted-foreground">{labels.online}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
              {kpis.onlineBookings}
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-muted/15 px-3 py-3">
            <p className="text-xs text-muted-foreground">{labels.manual}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
              {kpis.manualBookings}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
