import { getServiceRoleClient } from "@/lib/supabase/service-role"

let cached: boolean | null = null

export async function isReferralPersistenceReady(): Promise<boolean> {
  if (cached !== null) return cached

  const admin = getServiceRoleClient()
  if (!admin) {
    cached = false
    return false
  }

  const { error } = await admin.from("business_referral_codes").select("business_id").limit(1)
  cached = !error
  return cached
}
