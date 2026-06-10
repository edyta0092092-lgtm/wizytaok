"use client"

import Link from "next/link"
import { CheckCircle2, Hourglass } from "lucide-react"

import { useTranslations } from "@/lib/i18n/use-translations"
import { cn } from "@/lib/utils"

type DashboardDayStatsStripProps = {
  confirmed: number
  pending: number
  loading?: boolean
}

function StatChip({
  href,
  label,
  value,
  icon: Icon,
  accent,
}: {
  href: string
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  accent?: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-[3.5rem] flex-1 touch-manipulation flex-col justify-center rounded-2xl border px-4 py-3 shadow-sm shadow-slate-900/5 transition-colors",
        accent
          ? "border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10"
          : "border-border bg-card hover:border-primary/30 hover:bg-muted/20",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Icon className={cn("size-4 shrink-0", accent ? "text-amber-700 dark:text-amber-200" : "text-primary")} aria-hidden />
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
    </Link>
  )
}

export function DashboardDayStatsStrip({ confirmed, pending, loading }: DashboardDayStatsStripProps) {
  const { t } = useTranslations()

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        {t("dashboard.statsLoading")}
      </p>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-2.5">
      <StatChip
        href="/appointments?status=confirmed&date=today"
        label={t("dashboard.confirmed")}
        value={confirmed}
        icon={CheckCircle2}
      />
      <StatChip
        href="/appointments?status=pending&date=today"
        label={t("dashboard.pendingToday")}
        value={pending}
        icon={Hourglass}
        accent={pending > 0}
      />
    </div>
  )
}
