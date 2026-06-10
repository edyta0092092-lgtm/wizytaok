"use client"

import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { appointmentShowsNeedsActionStatus } from "@/lib/appointments/stats-rules"
import { useTranslations } from "@/lib/i18n/use-translations"
import type { Appointment } from "@/types/domain"

type DashboardMobileUpcomingListProps = {
  rows: Appointment[]
  excludeId?: string | null
  currentTime: Date
  loading?: boolean
  timeFmt: Intl.DateTimeFormat
  maxItems?: number
}

export function DashboardMobileUpcomingList({
  rows,
  excludeId,
  currentTime,
  loading,
  timeFmt,
  maxItems = 6,
}: DashboardMobileUpcomingListProps) {
  const { t } = useTranslations()

  const visibleRows = rows.filter((row) => row.id !== excludeId).slice(0, maxItems)

  return (
    <Card className="rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-semibold">{t("dashboard.mobileUpcomingTitle")}</CardTitle>
        <Link href="/appointments?date=today" className="text-xs font-medium text-primary">
          {t("dashboard.nextAppointmentOpen")}
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <p className="px-4 py-5 text-sm text-muted-foreground">{t("dashboard.statsLoading")}</p>
        ) : visibleRows.length === 0 ? (
          <p className="px-4 py-5 text-sm text-muted-foreground">{t("dashboard.noAppointmentsTodayShort")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {visibleRows.map((row) => (
              <li key={row.id}>
                <Link
                  href="/appointments"
                  className="flex min-h-[3.75rem] touch-manipulation items-center gap-3 px-4 py-3"
                >
                  <span className="w-14 shrink-0 text-sm font-semibold tabular-nums text-primary">
                    {timeFmt.format(new Date(row.startsAt))}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{row.clientName}</p>
                    <p className="truncate text-xs text-muted-foreground">{row.serviceLabel}</p>
                  </div>
                  <StatusBadge
                    status={row.status}
                    needsAction={appointmentShowsNeedsActionStatus(row, currentTime)}
                  />
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
