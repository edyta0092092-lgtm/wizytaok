import {
  DEFAULT_FIRST_REMINDER_MINUTES,
  DEFAULT_SECOND_REMINDER_MINUTES,
  parseReminderSettingsFromTemplateRows,
} from "@/lib/messages/reminder-settings-from-templates"
import { getCurrentBusinessProfileIdForClient } from "@/lib/services/services-store"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import type { BusinessReminderChannelPersisted } from "@/types/domain"

export type BusinessReminderPanelSettings = {
  defaultReminderHours: number
  defaultReminderMinutes: number
  secondReminderMinutes: number
  reminderChannel: BusinessReminderChannelPersisted
}

export const DEFAULT_BUSINESS_REMINDER_PANEL_SETTINGS: BusinessReminderPanelSettings = {
  defaultReminderHours: 24,
  defaultReminderMinutes: DEFAULT_FIRST_REMINDER_MINUTES,
  secondReminderMinutes: DEFAULT_SECOND_REMINDER_MINUTES,
  reminderChannel: "both",
}

export function normalizeBusinessReminderPanelSettings(
  row: {
    default_reminder_hours?: number | null
    default_reminder_minutes?: number | null
    second_reminder_minutes?: number | null
    reminder_channel?: string | null
  } | null
  | undefined,
): BusinessReminderPanelSettings {
  if (!row) return DEFAULT_BUSINESS_REMINDER_PANEL_SETTINGS
  const defaultReminderMinutes =
    typeof row.default_reminder_minutes === "number" && Number.isFinite(row.default_reminder_minutes)
      ? Math.max(1, Math.floor(row.default_reminder_minutes))
      : typeof row.default_reminder_hours === "number" && Number.isFinite(row.default_reminder_hours)
        ? Math.max(1, Math.floor(row.default_reminder_hours)) * 60
        : DEFAULT_BUSINESS_REMINDER_PANEL_SETTINGS.defaultReminderMinutes
  const secondReminderMinutes =
    typeof row.second_reminder_minutes === "number" && Number.isFinite(row.second_reminder_minutes)
      ? Math.max(0, Math.floor(row.second_reminder_minutes))
      : DEFAULT_BUSINESS_REMINDER_PANEL_SETTINGS.secondReminderMinutes
  const reminderChannel: BusinessReminderChannelPersisted =
    row.reminder_channel === "sms" || row.reminder_channel === "email" || row.reminder_channel === "both"
      ? row.reminder_channel
      : "both"
  return {
    defaultReminderHours: Math.max(1, Math.ceil(defaultReminderMinutes / 60)),
    defaultReminderMinutes,
    secondReminderMinutes,
    reminderChannel,
  }
}

/** Źródło prawdy: szablony w panelu Wiadomości (`message_templates`). */
export async function fetchBusinessReminderPanelSettings(
  businessId: string,
): Promise<BusinessReminderPanelSettings> {
  const client = getBrowserClient()
  if (!client) return DEFAULT_BUSINESS_REMINDER_PANEL_SETTINGS
  const { data, error } = await client
    .from("message_templates")
    .select("type,channel,status,timing_minutes_before")
    .eq("business_id", businessId)
  if (error) return DEFAULT_BUSINESS_REMINDER_PANEL_SETTINGS
  return parseReminderSettingsFromTemplateRows(data ?? [])
}

export async function loadBusinessReminderPanelSettingsForCurrentBusiness(
  knownBusinessId?: string | null,
): Promise<BusinessReminderPanelSettings> {
  if (!isSupabaseConfigured()) return DEFAULT_BUSINESS_REMINDER_PANEL_SETTINGS
  const client = getBrowserClient()
  if (!client) return DEFAULT_BUSINESS_REMINDER_PANEL_SETTINGS
  const businessId =
    knownBusinessId?.trim() || (await getCurrentBusinessProfileIdForClient(client, knownBusinessId))
  if (!businessId) return DEFAULT_BUSINESS_REMINDER_PANEL_SETTINGS
  return fetchBusinessReminderPanelSettings(businessId)
}
