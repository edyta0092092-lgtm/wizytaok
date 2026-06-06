import type { SupabaseClient } from "@supabase/supabase-js"

import {
  getSmsQuotaStatus,
  SMS_MONTHLY_LIMIT_REACHED,
  SMS_QUOTA_COUNT_FAILED,
  type SmsQuotaStatus,
} from "@/lib/notifications/sms-monthly-limit"
import type { Database } from "@/types/database"

type Admin = SupabaseClient<Database>

export { SMS_MONTHLY_LIMIT_REACHED, SMS_QUOTA_COUNT_FAILED }
export type { SmsQuotaStatus }

/** Poziom ostrzeżenia w panelu — progi: 20, 10, 0 pozostałych. */
export type SmsQuotaWarningLevel = "none" | "warning_20" | "warning_10" | "exhausted"

export function resolveSmsQuotaWarningLevel(remaining: number | null): SmsQuotaWarningLevel {
  if (remaining === null) return "none"
  if (remaining <= 0) return "exhausted"
  if (remaining <= 10) return "warning_10"
  if (remaining <= 20) return "warning_20"
  return "none"
}

export type SmsQuotaSendDecision =
  | { allowed: true; quota: SmsQuotaStatus }
  | {
      allowed: false
      reason: typeof SMS_MONTHLY_LIMIT_REACHED | typeof SMS_QUOTA_COUNT_FAILED
      quota: SmsQuotaStatus
    }

export function isSmsMonthlyLimitExhausted(quota: SmsQuotaStatus): boolean {
  return !quota.countFailed && !quota.allowed
}

/** Wspólna bramka przed wysyłką SMS — używa getSmsQuotaStatus(). */
export async function evaluateSmsQuotaForSend(
  admin: Admin,
  businessId: string,
): Promise<SmsQuotaSendDecision> {
  const quota = await getSmsQuotaStatus(admin, businessId)
  if (quota.countFailed) {
    return { allowed: false, reason: SMS_QUOTA_COUNT_FAILED, quota }
  }
  if (!quota.allowed) {
    return { allowed: false, reason: SMS_MONTHLY_LIMIT_REACHED, quota }
  }
  return { allowed: true, quota }
}
