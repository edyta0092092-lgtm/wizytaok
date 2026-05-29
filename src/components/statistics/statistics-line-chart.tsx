"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type {
  StatisticsChartPoint,
  StatisticsRange,
} from "@/lib/statistics/statistics-types"
import { cn } from "@/lib/utils"

type SeriesKey = "confirmed" | "completed" | "cancelled" | "noShow"

const TOTAL_FILL = "#0f766e"

const SERIES: Array<{
  key: SeriesKey
  dataKey: SeriesKey
  fill: string
}> = [
  { key: "confirmed", dataKey: "confirmed", fill: "#0ea5e9" },
  { key: "completed", dataKey: "completed", fill: "#10b981" },
  { key: "cancelled", dataKey: "cancelled", fill: "#f59e0b" },
  { key: "noShow", dataKey: "noShow", fill: "#f43f5e" },
]

function xAxisTickInterval(pointCount: number): number {
  if (pointCount <= 8) return 0
  if (pointCount <= 16) return 1
  if (pointCount <= 31) return 4
  return 2
}

type ChartCopy = {
  title: string
  subtitle: string
  ranges: Record<StatisticsRange, string>
  series: Record<SeriesKey, string>
  total: string
  empty: string
  axes: {
    x: string
    y: string
  }
  periodHint: Record<StatisticsRange, string>
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
  copy: ChartCopy
}) {
  const chartData = points.map((point) => ({
    label: point.label,
    confirmed: point.confirmed,
    completed: point.completed,
    cancelled: point.cancelled,
    noShow: point.noShow,
    total: point.confirmed + point.completed + point.cancelled + point.noShow,
  }))
  const tickInterval = xAxisTickInterval(chartData.length)

  return (
    <Card className="rounded-3xl border-border/80 bg-card/95 shadow-sm shadow-slate-900/5">
      <CardHeader className="gap-3 px-5 sm:flex sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-base">{copy.title}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{copy.subtitle}</p>
          <p className="mt-1 text-xs text-muted-foreground">{copy.periodHint[range]}</p>
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
        {points.length === 0 ? (
          <div className="flex h-72 items-center justify-center rounded-2xl border border-border/70 bg-muted/15 text-sm text-muted-foreground">
            {copy.empty}
          </div>
        ) : (
          <div className="rounded-2xl border border-border/70 bg-muted/15 px-2 py-4 sm:px-4">
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 8, right: 8, left: 0, bottom: 48 }}
                  barCategoryGap="18%"
                  barGap={2}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/60" />
                  <XAxis
                    dataKey="label"
                    interval={tickInterval}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    angle={chartData.length > 10 ? -40 : 0}
                    textAnchor={chartData.length > 10 ? "end" : "middle"}
                    height={chartData.length > 10 ? 56 : 32}
                    label={{
                      value: copy.axes.x,
                      position: "insideBottom",
                      offset: chartData.length > 10 ? -8 : -4,
                      fill: "var(--muted-foreground)",
                      fontSize: 12,
                    }}
                  />
                  <YAxis
                    allowDecimals={false}
                    width={36}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    label={{
                      value: copy.axes.y,
                      angle: -90,
                      position: "insideLeft",
                      offset: 12,
                      fill: "var(--muted-foreground)",
                      fontSize: 12,
                    }}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      const row = payload[0]?.payload as
                        | (typeof chartData)[number]
                        | undefined
                      if (!row) return null
                      return (
                        <div className="rounded-xl border border-border/80 bg-card px-3 py-2.5 text-xs shadow-lg">
                          <p className="mb-2 font-medium text-foreground">{label}</p>
                          <div className="mb-2 flex items-center justify-between gap-4 border-b border-border/60 pb-2">
                            <span className="text-muted-foreground">{copy.total}</span>
                            <span className="font-semibold tabular-nums text-foreground">
                              {row.total}
                            </span>
                          </div>
                          <ul className="space-y-1">
                            {SERIES.map((series) => (
                              <li
                                key={series.key}
                                className="flex items-center justify-between gap-4"
                              >
                                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                                  <span
                                    className="size-2 rounded-sm"
                                    style={{ backgroundColor: series.fill }}
                                    aria-hidden
                                  />
                                  {copy.series[series.key]}
                                </span>
                                <span className="font-semibold tabular-nums text-foreground">
                                  {row[series.dataKey]}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )
                    }}
                    cursor={{ fill: "var(--muted)", fillOpacity: 0.35 }}
                  />
                  <Bar
                    dataKey="total"
                    name={copy.total}
                    fill={TOTAL_FILL}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
