"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { formatCustomerDateTime } from "@/lib/customers/format-customer-datetime"
import type { CustomerVisitRow } from "@/lib/customers/customer-types"
import { useTranslations } from "@/lib/i18n/use-translations"
import { cn } from "@/lib/utils"

type CustomerVisitHistoryAccordionProps = {
  visits: CustomerVisitRow[]
  defaultOpen?: boolean
}

export function CustomerVisitHistoryAccordion({
  visits,
  defaultOpen = false,
}: CustomerVisitHistoryAccordionProps) {
  const { t, language } = useTranslations()
  const [open, setOpen] = React.useState(defaultOpen)

  if (visits.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        {t("customers.profile.noVisits")}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5">
      <button
        type="button"
        className="flex min-h-12 w-full touch-manipulation items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="text-sm font-semibold text-foreground">
          {t("customers.profile.historyTitle")}
          <span className="ml-2 font-normal text-muted-foreground">({visits.length})</span>
        </span>
        <ChevronDown
          className={cn("size-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open ? (
        <ul className="divide-y divide-border border-t border-border">
          {visits.map((visit) => (
            <li
              key={visit.id}
              className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {formatCustomerDateTime(visit.startsAt, language)}
                </p>
                <p className="text-sm text-muted-foreground">{visit.serviceLabel}</p>
                <p className="text-xs text-muted-foreground">
                  {t("customers.profile.staffLine")}: {visit.staffName}
                </p>
              </div>
              <StatusBadge status={visit.status} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
