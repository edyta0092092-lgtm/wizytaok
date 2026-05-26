import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { StatisticsHeatmapItem } from "@/lib/statistics/statistics-types"
import { cn } from "@/lib/utils"

function HeatmapCell({ item }: { item: StatisticsHeatmapItem }) {
  const level =
    item.intensity >= 0.8
      ? "bg-primary text-primary-foreground"
      : item.intensity >= 0.5
        ? "bg-primary/65 text-primary-foreground"
        : item.intensity > 0
          ? "bg-primary/20 text-foreground"
          : "bg-muted/50 text-muted-foreground"

  return (
    <div className={cn("rounded-2xl px-3 py-3 text-center", level)}>
      <p className="text-xs font-medium">{item.label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{item.count}</p>
    </div>
  )
}

export function StatisticsHeatmap({
  title,
  subtitle,
  days,
  hours,
  busyDaysTitle,
  busyHoursTitle,
}: {
  title: string
  subtitle: string
  days: StatisticsHeatmapItem[]
  hours: StatisticsHeatmapItem[]
  busyDaysTitle: string
  busyHoursTitle: string
}) {
  return (
    <Card className="rounded-3xl border-border/80 bg-card/95 shadow-sm shadow-slate-900/5">
      <CardHeader className="px-5">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent className="space-y-5 px-5 pb-5">
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {busyDaysTitle}
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {days.map((item) => (
              <HeatmapCell key={item.key} item={item} />
            ))}
          </div>
        </section>
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {busyHoursTitle}
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
            {hours.map((item) => (
              <HeatmapCell key={item.key} item={item} />
            ))}
          </div>
        </section>
      </CardContent>
    </Card>
  )
}
