"use client"

import type { LucideIcon } from "lucide-react"
import { UserPlus, Users } from "lucide-react"

import { KpiCard } from "@/components/shared/kpi-card"
import type { CustomerKpis } from "@/lib/customers/customer-types"
import { cn } from "@/lib/utils"

export type CustomersKpiCopy = {
  total: string
  newThisMonth: string
}

export function CustomersKpiGrid({
  kpis,
  copy,
  className,
  cardClassName,
}: {
  kpis: CustomerKpis
  copy: CustomersKpiCopy
  className?: string
  cardClassName?: string
}) {
  const cards: Array<{ label: string; value: string; icon: LucideIcon }> = [
    { label: copy.total, value: String(kpis.totalCustomers), icon: Users },
    { label: copy.newThisMonth, value: String(kpis.newThisMonth), icon: UserPlus },
  ]

  return (
    <div className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-4", className)}>
      {cards.map((card) => (
        <KpiCard key={card.label} {...card} className={cardClassName} />
      ))}
    </div>
  )
}
