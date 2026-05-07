"use client"

import * as React from "react"

import type { SupabaseBookingReminderLineLabels } from "@/lib/appointments/supabase-booking-reminder-line"

export function useAppointmentReminderLineLabels(
  t: (key: string) => string,
): SupabaseBookingReminderLineLabels {
  return React.useMemo(
    () => ({
      sent: t("appointments.reminderStatusSent"),
      failed: t("appointments.reminderStatusFailed"),
      skipped: t("appointments.reminderStatusSkipped"),
      notConfigured: t("appointments.reminderStatusNotConfigured"),
      scheduled: t("appointments.reminderStatusScheduled"),
    }),
    [t],
  )
}
