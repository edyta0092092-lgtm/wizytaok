import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type {
  StatisticsChartPoint,
  StatisticsRange,
} from "@/lib/statistics/statistics-types"
import { cn } from "@/lib/utils"

type SeriesKey = "created" | "completed" | "cancelled" | "noShow"

const SERIES: Array<{
  key: SeriesKey
  className: string
  labelClassName: string
}> = [
  {
    key: "created",
    className: "stroke-primary",
    labelClassName: "bg-primary",
  },
  {
    key: "completed",
    className: "stroke-emerald-500",
    labelClassName: "bg-emerald-500",
  },
  {
    key: "cancelled",
    className: "stroke-amber-500",
    labelClassName: "bg-amber-500",
  },
  {
    key: "noShow",
    className: "stroke-rose-500",
    labelClassName: "bg-rose-500",
  },
]

function polylinePoints(points: StatisticsChartPoint[], key: SeriesKey, max: number): string {
  if (points.length === 0) return ""
  const width = 100
  const height = 100
  const denominator = Math.max(1, points.length - 1)
  return points
    .map((point, index) => {
      const x = (index / denominator) * width
      const y = height - (point[key] / Math.max(1, max)) * 82 - 9
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(" ")
}

export function StatisticsLineChart({
  points,
  range,
  onRangeChange,
  copy,
}: {
  points: StatisticsChartPoint[]
  range: StatisticsRange
  onRangeChange: (range: StatisticsRange) => void
  copy: {
    title: string
    subtitle: string
    ranges: Record<StatisticsRange, string>
    series: Record<SeriesKey, string>
    empty: string
  }
}) {
  const max = Math.max(
    1,
    ...points.flatMap((point) => [
      point.created,
      point.completed,
      point.cancelled,
      point.noShow,
    ])
  )
  const labels = points.length > 10
    ? points.filter((_, index) => index === 0 || index === points.length - 1)
    : points

  return (
    <Card className="rounded-3xl border-border/80 bg-card/95 shadow-sm shadow-slate-900/5">
      <CardHeader className="gap-3 px-5 sm:flex sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-base">{copy.title}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{copy.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(copy.ranges) as StatisticsRange[]).map((item) => (
            <button
              key={item}
              type="button"
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                range === item
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              onClick={() => onRangeChange(item)}
            >
              {copy.ranges[item]}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {SERIES.map((series) => (
            <span key={series.key} className="inline-flex items-center gap-1.5">
              <span className={cn("size-2 rounded-full", series.labelClassName)} />
              {copy.series[series.key]}
            </span>
          ))}
        </div>
        <div className="mt-5 rounded-2xl border border-border/70 bg-muted/15 px-3 py-4">
          {points.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              {copy.empty}
            </div>
          ) : (
            <>
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="h-64 w-full overflow-visible"
                role="img"
                aria-label={copy.title}
              >
                {[20, 40, 60, 80].map((line) => (
                  <line
                    key={line}
                    x1="0"
                    x2="100"
                    y1={line}
                    y2={line}
                    className="stroke-border/70"
                    strokeWidth="0.35"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                {SERIES.map((series) => (
                  <polyline
                    key={series.key}
                    fill="none"
                    points={polylinePoints(points, series.key, max)}
                    className={cn(series.className, "drop-shadow-sm")}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </svg>
              <div className="mt-3 flex justify-between gap-3 text-[0.68rem] text-muted-foreground">
                {labels.map((point) => (
                  <span key={point.key}>{point.label}</span>
                ))}
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
