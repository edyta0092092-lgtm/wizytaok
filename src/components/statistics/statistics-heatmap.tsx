import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { NativeSelect } from "@/components/ui/native-select"
import type { StatisticsMonthOption } from "@/components/statistics/statistics-line-chart"
import type {
  StatisticsHeatmapItem,
  StatisticsPresetRange,
  StatisticsRange,
} from "@/lib/statistics/statistics-types"
import { cn } from "@/lib/utils"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

function toneFromIntensity(intensity: number): string {
  // Primary hue with varying alpha (0.15..1.0)
  const alpha = Math.max(0.15, Math.min(1, intensity === 0 ? 0.15 : 0.15 + intensity * 0.85))
  return `color-mix(in srgb, var(--primary) ${Math.round(alpha * 100)}%, transparent)`
}

export function StatisticsHeatmap({
  title,
  subtitle,
  days,
  hours,
  busyDaysTitle,
  busyHoursTitle,
  busyDaysHint,
  busyHoursHint,
  averageLabel,
  hoursValueLabel,
  range,
  ranges,
  onRangeChange,
  monthOptions,
  monthPlaceholder,
}: {
  title: string
  subtitle: string
  days: StatisticsHeatmapItem[]
  hours: StatisticsHeatmapItem[]
  busyDaysTitle: string
  busyHoursTitle: string
  busyDaysHint?: string
  busyHoursHint?: string
  averageLabel: string
  hoursValueLabel: string
  range: StatisticsRange
  ranges: Record<StatisticsPresetRange, string>
  onRangeChange: (range: StatisticsRange) => void
  monthOptions: StatisticsMonthOption[]
  monthPlaceholder: string
}) {
  const isMonthRange = range.startsWith("month:") || range.startsWith("year:")
  const dayData = days.map((item) => ({
    key: item.key,
    label: item.label,
    count: item.count,
    intensity: item.intensity,
  }))
  const hourData = hours.map((item) => ({
    key: item.key,
    label: item.label,
    count: item.count,
    intensity: item.intensity,
  }))

  return (
    <Card className="rounded-3xl border-border/80 bg-card/95 shadow-sm shadow-slate-900/5">
      <CardHeader className="gap-3 px-5 sm:flex sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {(Object.keys(ranges) as StatisticsPresetRange[]).map((item) => (
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
              {ranges[item]}
            </button>
          ))}
          {monthOptions.length > 0 ? (
            <NativeSelect
              value={isMonthRange ? range : ""}
              onChange={(event) => {
                if (event.target.value) onRangeChange(event.target.value as StatisticsRange)
              }}
              className={cn(
                "rounded-full py-1.5 pl-3 text-xs font-medium transition-colors",
                isMonthRange
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              chevronClassName={isMonthRange ? "text-primary-foreground" : undefined}
            >
              <option value="">{monthPlaceholder}</option>
              {monthOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-5 px-5 pb-5">
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {busyDaysTitle}
          </h3>
          {busyDaysHint ? (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{busyDaysHint}</p>
          ) : null}
          <div className="mt-3 h-56 rounded-2xl border border-border/70 bg-muted/15 px-2 py-3 sm:px-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dayData} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  className="stroke-border/60"
                />
                <XAxis
                  dataKey="label"
                  interval={0}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                />
                <YAxis
                  allowDecimals
                  width={32}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                />
                <Tooltip
                  cursor={false}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const value = payload[0]?.value
                    return (
                      <div className="rounded-xl border border-border/80 bg-card px-3 py-2.5 text-xs shadow-lg">
                        <p className="font-medium text-foreground">{label}</p>
                        <p className="mt-1 font-semibold tabular-nums text-foreground">
                          {typeof value === "number" ? value : 0} {averageLabel}
                        </p>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={48}>
                  {dayData.map((entry) => (
                    <Cell key={entry.key} fill={toneFromIntensity(entry.intensity)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {busyHoursTitle}
          </h3>
          {busyHoursHint ? (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{busyHoursHint}</p>
          ) : null}
          <div className="mt-3 h-64 rounded-2xl border border-border/70 bg-muted/15 px-2 py-3 sm:px-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourData} margin={{ top: 8, right: 8, left: 0, bottom: 44 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  className="stroke-border/60"
                />
                <XAxis
                  dataKey="label"
                  interval={1}
                  angle={-35}
                  textAnchor="end"
                  height={56}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                />
                <YAxis
                  allowDecimals
                  width={32}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                />
                <Tooltip
                  cursor={false}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const value = payload[0]?.value
                    return (
                      <div className="rounded-xl border border-border/80 bg-card px-3 py-2.5 text-xs shadow-lg">
                        <p className="font-medium text-foreground">{label}</p>
                        <p className="mt-1 font-semibold tabular-nums text-foreground">
                          {typeof value === "number" ? value : 0} {hoursValueLabel}
                        </p>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={28}>
                  {hourData.map((entry) => (
                    <Cell key={entry.key} fill={toneFromIntensity(entry.intensity)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </CardContent>
    </Card>
  )
}
