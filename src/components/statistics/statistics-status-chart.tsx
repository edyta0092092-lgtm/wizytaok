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
import { NativeSelect } from "@/components/ui/native-select"
import type { StatisticsMonthOption } from "@/components/statistics/statistics-line-chart"
import { useTranslations } from "@/lib/i18n/use-translations"
import type {
  StatisticsPresetRange,
  StatisticsRange,
  StatisticsStatusItem,
} from "@/lib/statistics/statistics-types"
import { cn } from "@/lib/utils"

const STATUS_TONE: Record<StatisticsStatusItem["status"], string> = {
  confirmed: "#0ea5e9",
  completed: "#10b981",
  cancelled: "#f59e0b",
  no_show: "#f43f5e",
}

const STATUS_LABEL_KEY: Record<StatisticsStatusItem["status"], string> = {
  confirmed: "appointments.confirmed",
  completed: "appointments.completed",
  cancelled: "appointments.cancelled",
  no_show: "appointments.noShow",
}

const STATUS_HINT_KEY: Record<StatisticsStatusItem["status"], string> = {
  confirmed: "statistics.statusHint.confirmed",
  completed: "statistics.statusHint.completed",
  cancelled: "statistics.statusHint.cancelled",
  no_show: "statistics.statusHint.noShow",
}

export function StatisticsStatusChart({
  title,
  subtitle,
  items,
  empty,
  axisY,
  range,
  ranges,
  onRangeChange,
  monthOptions,
  monthPlaceholder,
}: {
  title: string
  subtitle: string
  items: StatisticsStatusItem[]
  empty: string
  axisY: string
  range: StatisticsRange
  ranges: Record<StatisticsPresetRange, string>
  onRangeChange: (range: StatisticsRange) => void
  monthOptions: StatisticsMonthOption[]
  monthPlaceholder: string
}) {
  const { t, language } = useTranslations()
  const isMonthRange = range.startsWith("month:") || range.startsWith("year:")
  const visibleItems = items.filter((item) => item.count > 0)
  const chartData = visibleItems.map((item) => ({
    status: item.status,
    label: t(STATUS_LABEL_KEY[item.status]),
    count: item.count,
    percent: item.percent,
    fill: STATUS_TONE[item.status],
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
      <CardContent className="px-5 pb-5">
        {visibleItems.length === 0 ? (
          <div className="flex h-56 items-center justify-center rounded-2xl border border-border/70 bg-muted/15 text-sm text-muted-foreground">
            {empty}
          </div>
        ) : (
          <>
            <div className="h-64 w-full rounded-2xl border border-border/70 bg-muted/15 px-2 py-3 sm:px-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 8, right: 8, left: 0, bottom: 56 }}
                  barCategoryGap="22%"
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/60" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    interval={0}
                    angle={visibleItems.length > 2 ? -18 : 0}
                    textAnchor={visibleItems.length > 2 ? "end" : "middle"}
                    height={visibleItems.length > 2 ? 52 : 36}
                  />
                  <YAxis
                    allowDecimals={false}
                    width={32}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    label={{
                      value: axisY,
                      angle: -90,
                      position: "insideLeft",
                      offset: 10,
                      fill: "var(--muted-foreground)",
                      fontSize: 12,
                    }}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      const entry = payload[0]?.payload as (typeof chartData)[number] | undefined
                      return (
                        <div className="max-w-xs rounded-xl border border-border/80 bg-card px-3 py-2.5 text-xs shadow-lg">
                          <p className="font-medium text-foreground">{label}</p>
                          <p className="mt-1 font-semibold tabular-nums text-foreground">
                            {entry?.count ?? 0}{" "}
                            {language === "en" ? "visits" : "wizyt"} ({entry?.percent ?? 0}%)
                          </p>
                          {entry ? (
                            <p className="mt-2 text-muted-foreground">
                              {t(STATUS_HINT_KEY[entry.status])}
                            </p>
                          ) : null}
                        </div>
                      )
                    }}
                    cursor={{ fill: "var(--muted)", fillOpacity: 0.35 }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={72} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {visibleItems.map((item) => (
                <li
                  key={item.status}
                  className="rounded-2xl border border-border/70 bg-muted/15 px-3 py-2.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 text-muted-foreground">
                      <span
                        className={cn("size-2 rounded-full")}
                        style={{ backgroundColor: STATUS_TONE[item.status] }}
                        aria-hidden
                      />
                      {t(STATUS_LABEL_KEY[item.status])}
                    </span>
                    <span className="font-semibold tabular-nums text-foreground">
                      {item.count} ({item.percent}%)
                    </span>
                  </div>
                  <p className="mt-1 leading-relaxed text-muted-foreground">
                    {t(STATUS_HINT_KEY[item.status])}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}
