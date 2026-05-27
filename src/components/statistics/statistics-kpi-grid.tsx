import type { LucideIcon } from "lucide-react"
import {
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  CircleSlash,
  UserPlus,
  XCircle,
} from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import type { StatisticsKpis } from "@/lib/statistics/statistics-types"

type KpiCopy = {
  visitsToday: string
  visitsThisMonth: string
  completed: string
  cancelled: string
  noShow: string
  newClients: string
  daysWithVisits: string
}

type KpiCardProps = {
  label: string
  value: string
  helper?: string
  icon: LucideIcon
}

function KpiCard({ label, value, helper, icon: Icon }: KpiCardProps) {
  return (
    <Card className="rounded-3xl border-border/80 bg-card/95 shadow-sm shadow-slate-900/5">
      <CardContent className="px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground tabular-nums">
              {value}
            </p>
          </div>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl border border-border/80 bg-muted/40 text-primary">
            <Icon className="size-4" aria-hidden />
          </span>
        </div>
        {helper ? (
          <p className="mt-2 truncate text-xs text-muted-foreground">{helper}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function StatisticsKpiGrid({
  kpis,
  copy,
}: {
  kpis: StatisticsKpis
  copy: KpiCopy
}) {
  const cards: KpiCardProps[] = [
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
    {
      label: copy.newClients,
      value: String(kpis.newClients),
      icon: UserPlus,
    },
    {
      label: copy.daysWithVisits,
      value: String(kpis.daysWithVisits),
      icon: CalendarDays,
    },
  ]

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <KpiCard key={card.label} {...card} />
      ))}
    </section>
  )
}
