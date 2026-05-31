import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

type Admin = SupabaseClient<Database>

const DEFAULT_SMS_MONTHLY_LIMIT = 100

/**
 * Limit faktycznie wysłanych SMS-ów per firma per kalendarzowy miesiąc.
 * Konfigurowalny przez env `SMS_MONTHLY_INCLUDED_LIMIT`; fallback 100.
 * Negatywne / niesensowne wartości spadają do fallbacku.
 */
export function getSmsMonthlyLimit(): number {
  const raw = process.env.SMS_MONTHLY_INCLUDED_LIMIT?.trim()
  if (!raw) return DEFAULT_SMS_MONTHLY_LIMIT
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_SMS_MONTHLY_LIMIT
  return Math.floor(parsed)
}

/** Początek bieżącego miesiąca w strefie Europe/Warsaw, zwrócony jako UTC ISO. */
export function startOfMonthInWarsawIso(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now)
  const yearStr = parts.find((p) => p.type === "year")?.value
  const monthStr = parts.find((p) => p.type === "month")?.value
  if (!yearStr || !monthStr) {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0)).toISOString()
  }
  // Probe: 1. dnia miesiąca o 00:00 UTC. Godzina Warsaw tego momentu = bieżący
  // offset Warsaw (1 = CET, 2 = CEST).
  const probe = new Date(`${yearStr}-${monthStr}-01T00:00:00Z`)
  const hourStr = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Warsaw",
    hour: "2-digit",
    hour12: false,
  }).format(probe)
  const offsetHours = Number.parseInt(hourStr, 10)
  const safeOffset = Number.isFinite(offsetHours) ? offsetHours : 1
  return new Date(probe.getTime() - safeOffset * 3_600_000).toISOString()
}

export type SmsQuotaStatus = {
  used: number
  limit: number
  allowed: boolean
  /** true gdy nie udało się policzyć (błąd techniczny) — wołający powinien potraktować to jak retry. */
  countFailed: boolean
}

/**
 * Liczy faktycznie wysłane SMS-y (status='sent') w bieżącym miesiącu kalendarzowym
 * dla danej firmy. Wspólny budżet: przypomnienia (`appointment_reminders`) +
 * własne szablony (`custom_template_sends`). Pendings/failed/skipped nie liczą się.
 */
export async function getSmsQuotaStatus(admin: Admin, businessId: string): Promise<SmsQuotaStatus> {
  const limit = getSmsMonthlyLimit()
  const monthStartIso = startOfMonthInWarsawIso(new Date())

  const [reminders, custom] = await Promise.all([
    admin
      .from("appointment_reminders")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("channel", "sms")
      .eq("status", "sent")
      .gte("sent_at", monthStartIso),
    admin
      .from("custom_template_sends")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("channel", "sms")
      .eq("status", "sent")
      .gte("sent_at", monthStartIso),
  ])

  if (reminders.error && custom.error) {
    return { used: 0, limit, allowed: false, countFailed: true }
  }
  const reminderCount = reminders.error ? 0 : (reminders.count ?? 0)
  const customCount = custom.error ? 0 : (custom.count ?? 0)
  const used = reminderCount + customCount
  return { used, limit, allowed: used < limit, countFailed: false }
}
