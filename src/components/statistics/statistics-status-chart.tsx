import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { StatisticsStatusItem } from "@/lib/statistics/statistics-types"
import { cn } from "@/lib/utils"

const STATUS_TONE: Record<StatisticsStatusItem["status"], string> = {
  confirmed: "bg-sky-500",
  completed: "bg-emerald-500",
  cancelled: "bg-amber-500",
  no_show: "bg-rose-500",
}

export function StatisticsStatusChart({
  title,
  subtitle,
  items,
  labels,
}: {
  title: string
  subtitle: string
  items: StatisticsStatusItem[]
  labels: Record<StatisticsStatusItem["status"], string>
}) {
  return (
    <Card className="rounded-3xl border-border/80 bg-card/95 shadow-sm shadow-slate-900/5">
      <CardHeader className="px-5">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="flex h-3 overflow-hidden rounded-full bg-muted">
          {items.map((item) =>
            item.percent > 0 ? (
              <div
                key={item.status}
                className={cn("h-full", STATUS_TONE[item.status])}
                style={{ width: `${item.percent}%` }}
              />
            ) : null
          )}
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <div
              key={item.status}
              className="rounded-2xl border border-border/70 bg-muted/15 px-3 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <span className={cn("size-2 rounded-full", STATUS_TONE[item.status])} />
                  {labels[item.status]}
                </span>
                <span className="text-sm font-semibold tabular-nums text-foreground">
                  {item.count}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{item.percent}%</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
