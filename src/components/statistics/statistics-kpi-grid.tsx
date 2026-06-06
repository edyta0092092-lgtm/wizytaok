import {
  AlertCircle,
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  CircleSlash,
  UserPlus,
  XCircle,
} from "lucide-react"

import { KpiCard } from "@/components/shared/kpi-card"
import type { StatisticsKpis } from "@/lib/statistics/statistics-types"

type KpiCopy = {
  visitsToday: string
  visitsThisMonth: string
  totalVisits: string
  needsAction: string
  completed: string
  cancelled: string
  noShow: string
  newClients: string
  groupAllTime: string
  groupThisMonth: string
}

export function StatisticsKpiGrid({
  kpis,
  copy,
}: {
  kpis: StatisticsKpis
  copy: KpiCopy
}) {
  const allTimeCards = [
    {
      label: copy.totalVisits,
      value: String(kpis.totalVisits),
      icon: CalendarCheck2,
    },
    {
      label: copy.needsAction,
      value: String(kpis.needsAction),
      icon: AlertCircle,
    },
    {
      label: copy.completed,
      value: String(kpis.completed),
      icon: CheckCircle2,
    },
    {
      label: copy.cancelled,
      value: String(kpis.cancelled),
      icon: XCircle,
    },
    {
      label: copy.noShow,
      value: String(kpis.noShow),
      icon: CircleSlash,
    },
  ]

  const monthCards = [
    {
      label: copy.visitsToday,
      value: String(kpis.visitsToday),
      icon: CalendarClock,
    },
    {
      label: copy.visitsThisMonth,
      value: String(kpis.visitsThisMonth),
      icon: CalendarCheck2,
    },
    {
      label: copy.newClients,
      value: String(kpis.newClients),
      icon: UserPlus,
    },
  ]

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {copy.groupAllTime}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {allTimeCards.map((card) => (
            <KpiCard key={card.label} {...card} />
          ))}
        </div>
      </section>
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {copy.groupThisMonth}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {monthCards.map((card) => (
            <KpiCard key={card.label} {...card} />
          ))}
        </div>
      </section>
    </div>
  )
}
