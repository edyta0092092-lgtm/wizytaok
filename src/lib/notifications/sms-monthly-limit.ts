import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

type Admin = SupabaseClient<Database>

const DEFAULT_SMS_MONTHLY_LIMIT = 100

export const SMS_MONTHLY_LIMIT_REACHED = "sms_monthly_limit_reached" as const
export const SMS_QUOTA_COUNT_FAILED = "sms_quota_count_failed" as const

/**
 * Limit SMS w pakiecie abonamentowym (env `SMS_MONTHLY_INCLUDED_LIMIT`, fallback 100).
 * W przyszłości: odczyt z planu / billing per business_id.
 */
export function getSmsMonthlyIncludedLimit(): number {
  const raw = process.env.SMS_MONTHLY_INCLUDED_LIMIT?.trim()
  if (!raw) return DEFAULT_SMS_MONTHLY_LIMIT
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_SMS_MONTHLY_LIMIT
  return Math.floor(parsed)
}

/** @deprecated Użyj getSmsMonthlyIncludedLimit — alias dla istniejących importów. */
export function getSmsMonthlyLimit(): number {
  return getSmsMonthlyIncludedLimit()
}

/**
 * Dodatkowy limit z płatnych pakietów SMS (np. dokupione pakiety).
 * Obecnie 0 — hook pod przyszły billing.
 */
export async function getSmsMonthlyBonusLimit(_admin: Admin, _businessId: string): Promise<number> {
  return 0
}

/** Efektywny limit = pakiet abonamentu + dokupione pakiety. */
export async function getSmsEffectiveMonthlyLimit(admin: Admin, businessId: string): Promise<number> {
  const [included, bonus] = await Promise.all([
    Promise.resolve(getSmsMonthlyIncludedLimit()),
    getSmsMonthlyBonusLimit(admin, businessId),
  ])
  return included + bonus
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
  /** Efektywny limit (included + bonus). */
  limit: number
  /** Limit z abonamentu (bez dokupionych pakietów). */
  includedLimit: number
  /** Dokupione pakiety SMS — obecnie zawsze 0. */
  bonusLimit: number
  remaining: number | null
  allowed: boolean
  countFailed: boolean
}

/**
 * Liczy faktycznie wysłane SMS-y (status='sent') w bieżącym miesiącu kalendarzowym
 * dla danej firmy. Wspólny budżet ze wszystkich kanałów wysyłki SMS.
 */
export async function getSmsQuotaStatus(admin: Admin, businessId: string): Promise<SmsQuotaStatus> {
  const includedLimit = getSmsMonthlyIncludedLimit()
  const bonusLimit = await getSmsMonthlyBonusLimit(admin, businessId)
  const limit = includedLimit + bonusLimit
  const monthStartIso = startOfMonthInWarsawIso(new Date())

  const [reminders, custom, transactional] = await Promise.all([
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
    admin
      .from("notification_logs")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("channel", "sms")
      .eq("status", "sent")
      .gte("sent_at", monthStartIso),
  ])

  if (reminders.error && custom.error && transactional.error) {
    return {
      used: 0,
      limit,
      includedLimit,
      bonusLimit,
      remaining: null,
      allowed: false,
      countFailed: true,
    }
  }

  const reminderCount = reminders.error ? 0 : (reminders.count ?? 0)
  const customCount = custom.error ? 0 : (custom.count ?? 0)
  const transactionalCount = transactional.error ? 0 : (transactional.count ?? 0)
  const used = reminderCount + customCount + transactionalCount
  const remaining = Math.max(0, limit - used)

  return {
    used,
    limit,
    includedLimit,
    bonusLimit,
    remaining,
    allowed: used < limit,
    countFailed: false,
  }
}
