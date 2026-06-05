"use client"

import Link from "next/link"
import { ChevronRight, Mail, Phone } from "lucide-react"

import { CustomerSegmentBadge } from "@/components/customers/customer-segment-badge"
import { Card, CardContent } from "@/components/ui/card"
import { formatCustomerDate } from "@/lib/customers/format-customer-datetime"
import type { CustomerCrmRow } from "@/lib/customers/customer-types"
import { useTranslations } from "@/lib/i18n/use-translations"

export function CustomersList({ rows }: { rows: CustomerCrmRow[] }) {
  const { t, language } = useTranslations()

  return (
    <div className="space-y-2">
      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-sm md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">{t("customers.tableName")}</th>
              <th className="px-4 py-3 font-medium">{t("customers.tableContact")}</th>
              <th className="px-4 py-3 font-medium">{t("customers.tableVisits")}</th>
              <th className="px-4 py-3 font-medium">{t("customers.tableLastVisit")}</th>
              <th className="px-4 py-3 font-medium">{t("customers.tableNextVisit")}</th>
              <th className="px-4 py-3 font-medium">{t("customers.tableSegment")}</th>
              <th className="w-10 px-2 py-3" aria-hidden />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border/70 last:border-0 hover:bg-muted/20">
                <td className="px-4 py-3 font-medium text-foreground">{row.fullName}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  <div className="space-y-0.5">
                    {row.phone ? <span className="block">{row.phone}</span> : null}
                    {row.email ? <span className="block text-xs">{row.email}</span> : null}
                  </div>
                </td>
                <td className="px-4 py-3 tabular-nums">{row.visitCount}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {row.lastVisitAt ? formatCustomerDate(row.lastVisitAt, language) : "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {row.nextVisitAt ? formatCustomerDate(row.nextVisitAt, language) : "—"}
                </td>
                <td className="px-4 py-3">
                  <CustomerSegmentBadge segment={row.segment} />
                </td>
                <td className="px-2 py-3">
                  <Link
                    href={`/klienci/${encodeURIComponent(row.id)}`}
                    className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={t("customers.openProfile")}
                  >
                    <ChevronRight className="size-4" aria-hidden />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 md:hidden">
        {rows.map((row) => (
          <Link key={row.id} href={`/klienci/${encodeURIComponent(row.id)}`} className="block">
            <Card className="rounded-2xl border border-border shadow-sm transition-colors hover:border-primary/30 hover:bg-muted/20">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-foreground">{row.fullName}</p>
                  <CustomerSegmentBadge segment={row.segment} />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {row.phone ? (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="size-3" aria-hidden />
                      {row.phone}
                    </span>
                  ) : null}
                  {row.email ? (
                    <span className="inline-flex items-center gap-1">
                      <Mail className="size-3" aria-hidden />
                      {row.email}
                    </span>
                  ) : null}
                </div>
                <dl className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">{t("customers.tableVisits")}</dt>
                    <dd className="font-semibold tabular-nums text-foreground">{row.visitCount}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{t("customers.tableLastVisit")}</dt>
                    <dd className="font-medium text-foreground">
                      {row.lastVisitAt ? formatCustomerDate(row.lastVisitAt, language) : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{t("customers.tableNextVisit")}</dt>
                    <dd className="font-medium text-foreground">
                      {row.nextVisitAt ? formatCustomerDate(row.nextVisitAt, language) : "—"}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
