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
import { useTranslations } from "@/lib/i18n/use-translations"
import type { StatisticsStatusItem } from "@/lib/statistics/statistics-types"
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
}: {
  title: string
  subtitle: string
  items: StatisticsStatusItem[]
  empty: string
  axisY: string
}) {
  const { t, language } = useTranslations()
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
      <CardHeader className="px-5">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
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
