"use client"

import * as React from "react"

import type { AppointmentGroupKey } from "@/lib/appointments/appointments-grouping"
import { APPOINTMENT_GROUP_ORDER } from "@/lib/appointments/appointments-grouping"
import { useTranslations } from "@/lib/i18n/use-translations"
import type { Appointment } from "@/types/domain"

export type AppointmentsGroupedSectionsProps = {
  grouped: Record<AppointmentGroupKey, Appointment[]>
  renderRow: (ctx: {
    row: Appointment
    groupKey: AppointmentGroupKey
    indexInGroup: number
    groupLength: number
  }) => React.ReactNode
}

export function AppointmentsGroupedSections({
  grouped,
  renderRow,
}: AppointmentsGroupedSectionsProps) {
  const { t } = useTranslations()

  return (
    <>
      {APPOINTMENT_GROUP_ORDER.map((groupKey) => {
        const list = grouped[groupKey]
        if (list.length === 0) return null
        return (
          <section key={groupKey} className="space-y-2.5">
            <h2 className="text-sm font-semibold text-foreground">
              {groupKey === "past"
                ? t("appointments.past")
                : groupKey === "today"
                  ? t("appointments.today")
                  : groupKey === "tomorrow"
                    ? t("appointments.tomorrow")
                    : t("appointments.upcoming")}
            </h2>

            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5">
              {list.map((row, indexInGroup) =>
                renderRow({
                  row,
                  groupKey,
                  indexInGroup,
                  groupLength: list.length,
                }),
              )}
            </div>
          </section>
        )
      })}
    </>
  )
}
