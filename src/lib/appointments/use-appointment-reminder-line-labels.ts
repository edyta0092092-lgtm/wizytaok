"use client"

import * as React from "react"

import type { AppointmentReminderPanelLabels } from "@/lib/appointments/appointment-reminder-panel-display"
import type { SupabaseBookingReminderLineLabels } from "@/lib/appointments/supabase-booking-reminder-line"

export type AppointmentReminderLabelsBundle = {
  legacyLine: SupabaseBookingReminderLineLabels
  panel: AppointmentReminderPanelLabels
}

export function useAppointmentReminderLineLabels(
  t: (key: string) => string,
): AppointmentReminderLabelsBundle {
  return React.useMemo(
    () => ({
      legacyLine: {
        sent: t("appointments.reminderStatusSent"),
        failed: t("appointments.reminderStatusFailed"),
        skipped: t("appointments.reminderStatusSkipped"),
        notConfigured: t("appointments.reminderStatusNotConfigured"),
        scheduled: t("appointments.reminderStatusScheduled"),
      },
      panel: {
        firstTitle: t("appointments.reminderPanelFirstTitle"),
        secondTitle: t("appointments.reminderPanelSecondTitle"),
        channelEmail: t("appointments.reminderChannelEmail"),
        channelSms: t("appointments.reminderChannelSms"),
        statusPending: t("appointments.reminderQueuePending"),
        statusSent: t("appointments.reminderQueueSent"),
        statusFailed: t("appointments.reminderQueueFailed"),
        statusCancelled: t("appointments.reminderQueueCancelled"),
        statusSkipped: t("appointments.reminderQueueSkipped"),
        statusProcessing: t("appointments.reminderQueueProcessing"),
      },
    }),
    [t],
  )
}
