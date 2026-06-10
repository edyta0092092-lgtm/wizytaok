"use client"

import * as React from "react"
import Link from "next/link"
import { CalendarDays, Hourglass, Mail, MessageSquare } from "lucide-react"

import { useDashboardSmsQuota } from "@/lib/dashboard/use-dashboard-sms-quota"
import { useTranslations } from "@/lib/i18n/use-translations"
import { cn } from "@/lib/utils"

type DashboardMobileStatTilesProps = {
  todayCount: number
  pendingCount: number
  unreadMessagesCount: number
  statsLoading?: boolean
  messagesLoading?: boolean
}

function StatTile({
  href,
  label,
  value,
  icon: Icon,
  accent,
  loading,
}: {
  href: string
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  accent?: boolean
  loading?: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-[4.75rem] touch-manipulation flex-col justify-between rounded-2xl border px-3.5 py-3 shadow-sm shadow-slate-900/5",
        accent
          ? "border-amber-500/35 bg-amber-500/5"
          : "border-border bg-card",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium leading-snug text-muted-foreground">{label}</p>
        <Icon
          className={cn("size-4 shrink-0", accent ? "text-amber-700 dark:text-amber-200" : "text-primary")}
          aria-hidden
        />
      </div>
      <p className="text-2xl font-semibold tabular-nums text-foreground">
        {loading ? "…" : value}
      </p>
    </Link>
  )
}

export function DashboardMobileStatTiles({
  todayCount,
  pendingCount,
  unreadMessagesCount,
  statsLoading,
  messagesLoading,
}: DashboardMobileStatTilesProps) {
  const { t } = useTranslations()
  const sms = useDashboardSmsQuota()

  const smsValue =
    sms.loading || sms.used == null || sms.limit == null
      ? "…"
      : `${sms.used}/${sms.limit}`

  const smsAccent =
    sms.warningLevel === "exhausted" ||
    sms.warningLevel === "warning_10" ||
    sms.warningLevel === "warning_20"

  return (
    <div className="grid grid-cols-2 gap-2.5">
      <StatTile
        href="/appointments?date=today"
        label={t("dashboard.mobileStatTodayVisits")}
        value={String(todayCount)}
        icon={CalendarDays}
        loading={statsLoading}
      />
      <StatTile
        href="/appointments?status=pending&date=today"
        label={t("dashboard.mobileStatPending")}
        value={String(pendingCount)}
        icon={Hourglass}
        accent={pendingCount > 0}
        loading={statsLoading}
      />
      <StatTile
        href="/messages"
        label={t("dashboard.mobileStatUnreadMessages")}
        value={String(unreadMessagesCount)}
        icon={Mail}
        accent={unreadMessagesCount > 0}
        loading={messagesLoading}
      />
      <StatTile
        href="/messages"
        label={t("dashboard.mobileStatSmsUsage")}
        value={smsValue}
        icon={MessageSquare}
        accent={smsAccent}
        loading={sms.loading}
      />
    </div>
  )
}
