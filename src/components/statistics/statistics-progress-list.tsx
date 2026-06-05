import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { StatisticsRankItem } from "@/lib/statistics/statistics-types"

export function StatisticsProgressList({
  title,
  subtitle,
  items,
  empty,
  completedLabel,
}: {
  title: string
  subtitle: string
  items: StatisticsRankItem[]
  empty: string
  completedLabel?: string
}) {
  return (
    <Card className="rounded-2xl border-border/60 bg-card shadow-sm shadow-slate-900/[0.04]">
      <CardHeader className="px-5">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent className="space-y-4 px-5 pb-5">
        {items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            {empty}
          </p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                  {completedLabel && typeof item.completed === "number" ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {completedLabel}: {item.completed}
                    </p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums text-foreground">
                    {item.count}
                  </p>
                  <p className="text-xs text-muted-foreground">{item.percent}%</p>
                </div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.max(3, item.percent)}%` }}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
