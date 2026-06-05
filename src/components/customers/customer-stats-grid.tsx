"use client"

import { Card, CardContent } from "@/components/ui/card"
import { formatCustomerDate } from "@/lib/customers/format-customer-datetime"
import type { CustomerCrmRow } from "@/lib/customers/customer-types"
import { useTranslations } from "@/lib/i18n/use-translations"

export function CustomerStatsGrid({ customer }: { customer: CustomerCrmRow }) {
  const { t, language } = useTranslations()

  const items = [
    { label: t("customers.stats.visitCount"), value: String(customer.visitCount) },
    { label: t("customers.stats.completed"), value: String(customer.completedCount) },
    { label: t("customers.stats.cancelled"), value: String(customer.cancelledCount) },
    { label: t("customers.stats.noShow"), value: String(customer.noShowCount) },
    {
      label: t("customers.stats.firstVisit"),
      value: customer.firstVisitAt ? formatCustomerDate(customer.firstVisitAt, language) : "—",
    },
    {
      label: t("customers.stats.lastVisit"),
      value: customer.lastVisitAt ? formatCustomerDate(customer.lastVisitAt, language) : "—",
    },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <Card key={item.label} className="rounded-2xl border-border/60 shadow-sm">
          <CardContent className="px-4 py-4">
            <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
              {item.label}
            </p>
            <p className="mt-2 text-xl font-semibold tabular-nums text-foreground">{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
