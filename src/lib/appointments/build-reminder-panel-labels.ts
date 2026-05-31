import type { AppointmentReminderPanelLabels } from "@/lib/appointments/appointment-reminder-panel-display"
import type { BusinessReminderPanelSettings } from "@/lib/appointments/business-reminder-settings"
import {
  formatMinutesBeforeVisit,
  type ReminderUiLanguage,
} from "@/lib/appointments/reminder-duration-label"

export type ReminderPanelLabelsInput = {
  settings: BusinessReminderPanelSettings
  language: ReminderUiLanguage
  t: (key: string) => string
}

export function buildRemindersAutomatedPolicyText(input: ReminderPanelLabelsInput): string {
  const duration = formatMinutesBeforeVisit(input.settings.defaultReminderMinutes, input.language)
  if (input.language === "pl") {
    return `Przypomnienia są wysyłane automatycznie ${duration} przed wizytą.`
  }
  return `Reminders are sent automatically ${duration} before the appointment.`
}

export function buildFirstReminderSectionTitle(input: ReminderPanelLabelsInput): string {
  const duration = formatMinutesBeforeVisit(input.settings.defaultReminderMinutes, input.language)
  if (input.language === "pl") {
    return `Przypomnienie ${duration} przed wizytą`
  }
  return `Reminder ${duration} before the appointment`
}

export function buildSecondReminderSectionTitle(input: ReminderPanelLabelsInput): string {
  const duration = formatMinutesBeforeVisit(input.settings.secondReminderMinutes, input.language)
  if (input.language === "pl") {
    return `Drugie przypomnienie ${duration} przed wizytą`
  }
  return `Second reminder ${duration} before the appointment`
}

export function buildReminderPanelLabels(input: ReminderPanelLabelsInput): AppointmentReminderPanelLabels {
  const { settings, language, t } = input
  return {
    automatedPolicy: buildRemindersAutomatedPolicyText(input),
    noReminders: t("appointments.reminderPanelNoRows"),
    firstTitle: buildFirstReminderSectionTitle(input),
    secondTitle: buildSecondReminderSectionTitle(input),
    channelEmail: t("appointments.reminderChannelEmail"),
    channelSms: t("appointments.reminderChannelSms"),
    statusPending: t("appointments.reminderQueuePending"),
    statusSent: t("appointments.reminderQueueSent"),
    statusFailed: t("appointments.reminderQueueFailed"),
    statusCancelled: t("appointments.reminderQueueCancelled"),
    statusSkipped: t("appointments.reminderQueueSkipped"),
    statusProcessing: t("appointments.reminderQueueProcessing"),
    reminderChannel: settings.reminderChannel,
    secondReminderEnabled: settings.secondReminderMinutes > 0,
  }
}
