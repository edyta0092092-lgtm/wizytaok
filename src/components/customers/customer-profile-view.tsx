"use client"

import Link from "next/link"
import { ArrowLeft, Mail, Phone } from "lucide-react"

import { CustomerSegmentBadge } from "@/components/customers/customer-segment-badge"
import { CustomerStatsGrid } from "@/components/customers/customer-stats-grid"
import { CustomerVisitHistory } from "@/components/customers/customer-visit-history"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCustomerDate } from "@/lib/customers/format-customer-datetime"
import type { CustomerCrmRow } from "@/lib/customers/customer-types"
import { useTranslations } from "@/lib/i18n/use-translations"

export function CustomerProfileView({ customer }: { customer: CustomerCrmRow }) {
  const { t, language } = useTranslations()

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="h-9 w-fit rounded-xl" asChild>
        <Link href="/klienci">
          <ArrowLeft className="mr-1.5 size-4" aria-hidden />
          {t("customers.profile.backToList")}
        </Link>
      </Button>

      <Card className="rounded-2xl border border-border shadow-sm shadow-slate-900/5">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-xl">{customer.fullName}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{t("customers.profile.contactTitle")}</p>
            </div>
            <CustomerSegmentBadge segment={customer.segment} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-2 text-sm">
              <Phone className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div>
                <dt className="text-xs text-muted-foreground">{t("customers.fieldPhone")}</dt>
                <dd className="font-medium">{customer.phone || "—"}</dd>
              </div>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div>
                <dt className="text-xs text-muted-foreground">{t("customers.fieldEmail")}</dt>
                <dd className="font-medium break-all">{customer.email || "—"}</dd>
              </div>
            </div>
          </dl>
          {customer.nextVisitAt ? (
            <p className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
              <span className="font-medium text-foreground">{t("customers.profile.nextVisit")}: </span>
              <span className="text-muted-foreground">
                {formatCustomerDate(customer.nextVisitAt, language)}
              </span>
            </p>
          ) : null}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">{t("customers.profile.statsTitle")}</h2>
        <CustomerStatsGrid customer={customer} />
      </section>

      <section className="space-y-3">
        <CustomerVisitHistory visits={customer.visits} />
      </section>
    </div>
  )
}
