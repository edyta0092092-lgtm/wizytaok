"use client"

import { Globe, PenLine } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { StatisticsBookingChannels } from "@/lib/statistics/statistics-types"
import { cn } from "@/lib/utils"

export function StatisticsBookingsCard({
  title,
  subtitle,
  channels,
  labels,
}: {
  title: string
  subtitle: string
  channels: StatisticsBookingChannels
  labels: {
    online: string
    manual: string
    onlineShare: string
    empty: string
  }
}) {
  const total = channels.online + channels.manual
  const items = [
    { key: "online", label: labels.online, value: channels.online, icon: Globe, tone: "text-sky-600" },
    { key: "manual", label: labels.manual, value: channels.manual, icon: PenLine, tone: "text-muted-foreground" },
  ] as const

  return (
    <Card className="rounded-2xl border-border/60 bg-card shadow-sm shadow-slate-900/[0.04]">
      <CardHeader className="px-5 pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent className="space-y-4 px-5 pb-5">
        {total === 0 ? (
          <p className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
            {labels.empty}
          </p>
        ) : (
          <>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {labels.onlineShare}
                </p>
                <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-foreground">
                  {channels.onlinePercent}%
                </p>
              </div>
              <div className="h-2 flex-1 max-w-[12rem] overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${channels.onlinePercent}%` }}
                />
              </div>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {items.map((item) => {
                const Icon = item.icon
                const share = total > 0 ? Math.round((item.value / total) * 100) : 0
                return (
                  <li
                    key={item.key}
                    className="rounded-xl border border-border/60 bg-muted/15 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("inline-flex items-center gap-2 text-sm", item.tone)}>
                        <Icon className="size-4 shrink-0" aria-hidden />
                        {item.label}
                      </span>
                      <span className="text-sm font-semibold tabular-nums text-foreground">
                        {item.value}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground tabular-nums">{share}%</p>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}
