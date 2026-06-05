import type { LucideIcon } from "lucide-react"
import {
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  CircleSlash,
  Globe,
  PenLine,
  TrendingUp,
  UserPlus,
  XCircle,
} from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import type { StatisticsKpis } from "@/lib/statistics/statistics-types"

export type StatisticsKpiCopy = {
  visitsToday: string
  visitsThisMonth: string
  completed: string
  cancelled: string
  noShow: string
  newClients: string
  onlineBookings: string
  manualBookings: string
  avgDailyVisits: string
}

type KpiCardProps = {
  label: string
  value: string
  icon: LucideIcon
}

function KpiCard({ label, value, icon: Icon }: KpiCardProps) {
  return (
    <Card className="rounded-2xl border-border/60 bg-card shadow-sm shadow-slate-900/[0.04] transition-shadow hover:shadow-md hover:shadow-slate-900/[0.06]">
      <CardContent className="px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground tabular-nums sm:text-[1.75rem]">
              {value}
            </p>
          </div>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-[1.125rem]" aria-hidden />
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

export function StatisticsKpiGrid({
  kpis,
  copy,
}: {
  kpis: StatisticsKpis
  copy: StatisticsKpiCopy
}) {
  const cards: KpiCardProps[] = [
    { label: copy.visitsToday, value: String(kpis.visitsToday), icon: CalendarClock },
    { label: copy.visitsThisMonth, value: String(kpis.visitsThisMonth), icon: CalendarCheck2 },
    { label: copy.completed, value: String(kpis.completed), icon: CheckCircle2 },
    { label: copy.cancelled, value: String(kpis.cancelled), icon: XCircle },
    { label: copy.noShow, value: String(kpis.noShow), icon: CircleSlash },
    { label: copy.newClients, value: String(kpis.newClients), icon: UserPlus },
    { label: copy.onlineBookings, value: String(kpis.onlineBookings), icon: Globe },
    { label: copy.manualBookings, value: String(kpis.manualBookings), icon: PenLine },
    {
      label: copy.avgDailyVisits,
      value: String(kpis.avgDailyVisits),
      icon: TrendingUp,
    },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-3">
      {cards.map((card) => (
        <KpiCard key={card.label} {...card} />
      ))}
    </div>
  )
}
