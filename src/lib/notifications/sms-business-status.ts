import type { SupabaseClient } from "@supabase/supabase-js"

import { isSmsProviderConfigured } from "@/lib/notifications/sms-provider-configured"
import type { Database } from "@/types/database"

type Admin = SupabaseClient<Database>

export type SmsBusinessStatus = "active" | "needs_configuration" | "needs_template"

export async function businessHasActiveSmsTemplate(
  admin: Admin,
  businessId: string,
): Promise<boolean> {
  const bid = businessId.trim()
  if (!bid) return false

  const [builtIn, custom] = await Promise.all([
    admin
      .from("message_templates")
      .select("id", { count: "exact", head: true })
      .eq("business_id", bid)
      .eq("channel", "sms")
      .eq("status", "active"),
    admin
      .from("custom_templates")
      .select("id", { count: "exact", head: true })
      .eq("business_id", bid)
      .eq("status", "active")
      .eq("sms_enabled", true),
  ])

  const builtInCount = builtIn.error ? 0 : (builtIn.count ?? 0)
  const customCount = custom.error ? 0 : (custom.count ?? 0)
  return builtInCount + customCount > 0
}

export function resolveSmsBusinessStatus(args: {
  providerConfigured: boolean
  hasActiveSmsTemplate: boolean
}): SmsBusinessStatus {
  if (!args.providerConfigured) return "needs_configuration"
  if (!args.hasActiveSmsTemplate) return "needs_template"
  return "active"
}

export async function getSmsBusinessStatus(
  admin: Admin,
  businessId: string,
): Promise<SmsBusinessStatus> {
  const providerConfigured = isSmsProviderConfigured()
  const hasActiveSmsTemplate = providerConfigured
    ? await businessHasActiveSmsTemplate(admin, businessId)
    : false
  return resolveSmsBusinessStatus({ providerConfigured, hasActiveSmsTemplate })
}
