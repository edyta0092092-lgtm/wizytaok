import { MailCheck, MessageSquareText, TriangleAlert, Zap } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { StatisticsNotifications } from "@/lib/statistics/statistics-types"

export function StatisticsNotificationsCard({
  title,
  subtitle,
  stats,
  labels,
}: {
  title: string
  subtitle: string
  stats: StatisticsNotifications
  labels: {
    sms: string
    email: string
    failed: string
    failedHint: string
    successRate: string
    successRateHint: string
  }
}) {
  const items = [
    {
      label: labels.sms,
      value: stats.sentSms,
      icon: MessageSquareText,
    },
    {
      label: labels.email,
      value: stats.sentEmails,
      icon: MailCheck,
    },
    {
      label: labels.failed,
      value: stats.failed,
      hint: labels.failedHint,
      icon: TriangleAlert,
    },
    {
      label: labels.successRate,
      value: `${stats.reminderSuccessRate}%`,
      hint: labels.successRateHint,
      icon: Zap,
    },
  ]

  return (
    <Card className="rounded-2xl border-border/60 bg-card shadow-sm shadow-slate-900/[0.04]">
      <CardHeader className="px-5">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent className="grid gap-3 px-5 pb-5 sm:grid-cols-2">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <div
              key={item.label}
              className="rounded-2xl border border-border/70 bg-muted/15 px-4 py-4"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <span className="flex size-8 items-center justify-center rounded-xl bg-muted text-primary">
                  <Icon className="size-4" aria-hidden />
                </span>
              </div>
              <p className="mt-3 text-2xl font-semibold tabular-nums text-foreground">
                {item.value}
              </p>
              {"hint" in item && item.hint ? (
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.hint}</p>
              ) : null}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
