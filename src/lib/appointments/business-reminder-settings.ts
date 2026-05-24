import { getCurrentBusinessProfileIdForClient } from "@/lib/services/services-store"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import type { BusinessReminderChannelPersisted } from "@/types/domain"

export type BusinessReminderPanelSettings = {
  defaultReminderHours: number
  secondReminderMinutes: number
  reminderChannel: BusinessReminderChannelPersisted
}

export const DEFAULT_BUSINESS_REMINDER_PANEL_SETTINGS: BusinessReminderPanelSettings = {
  defaultReminderHours: 24,
  secondReminderMinutes: 120,
  reminderChannel: "both",
}

function coerceReminderChannel(raw: string | null | undefined): BusinessReminderChannelPersisted {
  if (raw === "sms" || raw === "email" || raw === "both") return raw
  return "both"
}

export function normalizeBusinessReminderPanelSettings(
  row: {
    default_reminder_hours?: number | null
    second_reminder_minutes?: number | null
    reminder_channel?: string | null
  } | null
  | undefined,
): BusinessReminderPanelSettings {
  if (!row) return DEFAULT_BUSINESS_REMINDER_PANEL_SETTINGS
  const defaultReminderHours =
    typeof row.default_reminder_hours === "number" && Number.isFinite(row.default_reminder_hours)
      ? Math.max(1, Math.floor(row.default_reminder_hours))
      : DEFAULT_BUSINESS_REMINDER_PANEL_SETTINGS.defaultReminderHours
  const secondReminderMinutes =
    typeof row.second_reminder_minutes === "number" && Number.isFinite(row.second_reminder_minutes)
      ? Math.max(0, Math.floor(row.second_reminder_minutes))
      : DEFAULT_BUSINESS_REMINDER_PANEL_SETTINGS.secondReminderMinutes
  return {
    defaultReminderHours,
    secondReminderMinutes,
    reminderChannel: coerceReminderChannel(row.reminder_channel),
  }
}

export async function fetchBusinessReminderPanelSettings(
  businessId: string,
): Promise<BusinessReminderPanelSettings> {
  const client = getBrowserClient()
  if (!client) return DEFAULT_BUSINESS_REMINDER_PANEL_SETTINGS
  const { data, error } = await client
    .from("business_profiles")
    .select("default_reminder_hours,second_reminder_minutes,reminder_channel")
    .eq("id", businessId)
    .maybeSingle()
  if (error) return DEFAULT_BUSINESS_REMINDER_PANEL_SETTINGS
  return normalizeBusinessReminderPanelSettings(data)
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
