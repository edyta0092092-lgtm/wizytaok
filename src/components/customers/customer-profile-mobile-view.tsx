"use client"

import Link from "next/link"
import { ArrowLeft, Pencil } from "lucide-react"

import { CustomerProfileMobileActions } from "@/components/customers/customer-profile-mobile-actions"
import { CustomerVisitHistoryAccordion } from "@/components/customers/customer-visit-history-accordion"
import { CustomerSegmentBadge } from "@/components/customers/customer-segment-badge"
import { Button } from "@/components/ui/button"
import { formatCustomerDateTime } from "@/lib/customers/format-customer-datetime"
import type { CustomerCrmRow } from "@/lib/customers/customer-types"
import { useTranslations } from "@/lib/i18n/use-translations"

type CustomerProfileMobileViewProps = {
  customer: CustomerCrmRow
  onEdit: () => void
}

function VisitHighlight({
  label,
  value,
  empty,
}: {
  label: string
  value: string | null
  empty: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3 shadow-sm shadow-slate-900/5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-semibold text-foreground">{value ?? empty}</p>
    </div>
  )
}

export function CustomerProfileMobileView({ customer, onEdit }: CustomerProfileMobileViewProps) {
  const { t, language } = useTranslations()
  const phone = customer.phone.trim()

  return (
    <>
      <div className="flex flex-col gap-4 pb-mobile-sticky-page">
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" className="h-10 w-fit touch-manipulation rounded-xl" asChild>
            <Link href="/klienci">
              <ArrowLeft className="mr-1.5 size-4" aria-hidden />
              {t("customers.profile.backToList")}
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 touch-manipulation rounded-xl"
            onClick={onEdit}
          >
            <Pencil className="mr-1.5 size-4" aria-hidden />
            {t("clients.editClient")}
          </Button>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold leading-tight text-foreground">{customer.fullName}</h1>
            <CustomerSegmentBadge segment={customer.segment} />
          </div>

          {phone ? (
            <a
              href={`tel:${phone.replace(/\s/g, "")}`}
              className="inline-flex min-h-11 touch-manipulation items-center text-lg font-medium text-primary"
            >
              {phone}
            </a>
          ) : (
            <p className="text-lg text-muted-foreground">—</p>
          )}
        </div>

        <div className="grid gap-3">
          <VisitHighlight
            label={t("customers.stats.lastVisit")}
            value={
              customer.lastVisitAt ? formatCustomerDateTime(customer.lastVisitAt, language) : null
            }
            empty={t("customers.profile.noLastVisit")}
          />
          <VisitHighlight
            label={t("customers.profile.nextVisit")}
            value={
              customer.nextVisitAt ? formatCustomerDateTime(customer.nextVisitAt, language) : null
            }
            empty={t("customers.profile.noNextVisit")}
          />
        </div>

        <CustomerVisitHistoryAccordion visits={customer.visits} defaultOpen={false} />
      </div>

      <CustomerProfileMobileActions phone={customer.phone} />
    </>
  )
}
