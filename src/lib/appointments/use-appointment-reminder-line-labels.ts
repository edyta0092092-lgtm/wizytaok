"use client"

import * as React from "react"

import type { AppointmentReminderPanelLabels } from "@/lib/appointments/appointment-reminder-panel-display"
import { buildReminderPanelLabels } from "@/lib/appointments/build-reminder-panel-labels"
import { useBusinessReminderSettings } from "@/lib/appointments/use-business-reminder-settings"
import type { ReminderUiLanguage } from "@/lib/appointments/reminder-duration-label"
import type { SupabaseBookingReminderLineLabels } from "@/lib/appointments/supabase-booking-reminder-line"

export type AppointmentReminderLabelsBundle = {
  legacyLine: SupabaseBookingReminderLineLabels
  panel: AppointmentReminderPanelLabels
}

export function useAppointmentReminderLineLabels(
  t: (key: string) => string,
  language: ReminderUiLanguage,
): AppointmentReminderLabelsBundle {
  const settings = useBusinessReminderSettings()
  return React.useMemo(
    () => ({
      legacyLine: {
        sent: t("appointments.reminderStatusSent"),
        failed: t("appointments.reminderStatusFailed"),
        skipped: t("appointments.reminderStatusSkipped"),
        notConfigured: t("appointments.reminderStatusNotConfigured"),
        scheduled: t("appointments.reminderStatusScheduled"),
      },
      panel: buildReminderPanelLabels({ settings, language, t }),
    }),
    [t, language, settings],
  )
}
