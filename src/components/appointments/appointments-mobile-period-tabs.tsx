"use client"

import {
  APPOINTMENTS_MOBILE_PERIOD_FILTERS,
  appointmentsMobilePeriodLabel,
  type AppointmentsMobilePeriodFilter,
} from "@/lib/appointments/appointments-mobile-period"
import { cn } from "@/lib/utils"
import { useTranslations } from "@/lib/i18n/use-translations"

type AppointmentsMobilePeriodTabsProps = {
  value: AppointmentsMobilePeriodFilter
  onChange: (next: AppointmentsMobilePeriodFilter) => void
}

export function AppointmentsMobilePeriodTabs({
  value,
  onChange,
}: AppointmentsMobilePeriodTabsProps) {
  const { t } = useTranslations()

  return (
    <div
      className="grid grid-cols-3 gap-1 rounded-2xl border border-border bg-muted/30 p-1"
      role="tablist"
      aria-label={t("appointments.mobilePeriodTabsLabel")}
    >
      {APPOINTMENTS_MOBILE_PERIOD_FILTERS.map((period) => {
        const active = value === period
        return (
          <button
            key={period}
            type="button"
            role="tab"
            aria-selected={active}
            className={cn(
              "min-h-11 touch-manipulation rounded-xl px-2 text-sm font-semibold transition-colors",
              active
                ? "bg-card text-foreground shadow-sm shadow-slate-900/5"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => onChange(period)}
          >
            {appointmentsMobilePeriodLabel(period, t)}
          </button>
        )
      })}
    </div>
  )
}
