import type { SupabaseClient } from "@supabase/supabase-js"

import {
  generateReferralCode,
  normalizeReferralCode,
  REFERRAL_CODE_LENGTH,
} from "@/lib/referrals/referral-code"
import {
  computeReferralStage,
  type ReferralConversionStage,
} from "@/lib/referrals/referral-stage"
import { getServiceRoleClient } from "@/lib/supabase/service-role"
import type { Database } from "@/types/database"

type AdminClient = SupabaseClient<Database>

export type ReferralDashboardRow = {
  id: string
  referralCode: string
  referredBusinessName: string
  stage: ReferralConversionStage
  registeredAt: string
  trialActivatedAt: string | null
  payingAt: string | null
}

export type ReferralDashboardStats = {
  registrations: number
  trialActivated: number
  paying: number
}

async function findReferrerBusinessIdByCode(
  admin: AdminClient,
  code: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from("business_referral_codes")
    .select("business_id")
    .eq("code", code)
    .maybeSingle()

  if (error || !data?.business_id) return null
  return data.business_id
}

export async function ensureReferralCodeForBusiness(businessId: string): Promise<string | null> {
  const admin = getServiceRoleClient()
  if (!admin) return null

  const { data: existing, error: existingErr } = await admin
    .from("business_referral_codes")
    .select("code")
    .eq("business_id", businessId)
    .maybeSingle()

  if (existingErr) return null
  if (existing?.code) return existing.code

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = generateReferralCode(REFERRAL_CODE_LENGTH)
    const { error: insertErr } = await admin.from("business_referral_codes").insert({
      business_id: businessId,
      code: candidate,
    })

    if (!insertErr) return candidate

    const msg = (insertErr.message ?? "").toLowerCase()
    if (!msg.includes("duplicate") && !msg.includes("unique")) {
      return null
    }
  }

  return null
}

export async function attachReferralForNewBusiness(input: {
  referredBusinessId: string
  referredUserId: string
  referralCode: string | null | undefined
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const normalized = normalizeReferralCode(input.referralCode)
  if (!normalized) return { ok: false, reason: "missing_code" }

  const admin = getServiceRoleClient()
  if (!admin) return { ok: false, reason: "no_service_role" }

  const referrerBusinessId = await findReferrerBusinessIdByCode(admin, normalized)
  if (!referrerBusinessId) return { ok: false, reason: "unknown_code" }

  if (referrerBusinessId === input.referredBusinessId) {
    return { ok: false, reason: "self_referral" }
  }

  const { data: referrerProfile } = await admin
    .from("business_profiles")
    .select("owner_id")
    .eq("id", referrerBusinessId)
    .maybeSingle()

  if (referrerProfile?.owner_id === input.referredUserId) {
    return { ok: false, reason: "self_referral" }
  }

  const { data: existingReferral } = await admin
    .from("business_referrals")
    .select("id")
    .eq("referred_business_id", input.referredBusinessId)
    .maybeSingle()

  if (existingReferral?.id) {
    return { ok: false, reason: "already_attributed" }
  }

  const { error } = await admin.from("business_referrals").insert({
    referrer_business_id: referrerBusinessId,
    referred_business_id: input.referredBusinessId,
    referred_user_id: input.referredUserId,
    referral_code: normalized,
    stage: "registered",
  })

  if (error) {
    const msg = (error.message ?? "").toLowerCase()
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return { ok: false, reason: "already_attributed" }
    }
    return { ok: false, reason: "insert_failed" }
  }

  return { ok: true }
}

async function syncReferralStages(admin: AdminClient, referrerBusinessId: string): Promise<void> {
  const { data: referrals, error } = await admin
    .from("business_referrals")
    .select(
      "id, stage, registered_at, trial_activated_at, paying_at, referred_business_id",
    )
    .eq("referrer_business_id", referrerBusinessId)

  if (error || !referrals?.length) return

  const businessIds = referrals.map((r) => r.referred_business_id)
  const { data: profiles } = await admin
    .from("business_profiles")
    .select(
      "id, business_name, subscription_status, stripe_subscription_status, subscription_trial_ends_at, trial_started_at, trial_used_at",
    )
    .in("id", businessIds)

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]))
  const nowIso = new Date().toISOString()

  for (const referral of referrals) {
    const profile = profileById.get(referral.referred_business_id)
    if (!profile) continue

    const nextStage = computeReferralStage(profile)
    const updates: Database["public"]["Tables"]["business_referrals"]["Update"] = {
      updated_at: nowIso,
    }

    if (nextStage !== referral.stage) {
      updates.stage = nextStage
    }
    if (
      (nextStage === "trial_activated" || nextStage === "paying") &&
      !referral.trial_activated_at
    ) {
      updates.trial_activated_at = nowIso
    }
    if (nextStage === "paying" && !referral.paying_at) {
      updates.paying_at = nowIso
    }

    if (Object.keys(updates).length <= 1) continue

    await admin.from("business_referrals").update(updates).eq("id", referral.id)
  }
}

export async function loadReferralDashboard(
  referrerBusinessId: string,
): Promise<{
  code: string | null
  stats: ReferralDashboardStats
  history: ReferralDashboardRow[]
} | null> {
  const admin = getServiceRoleClient()
  if (!admin) return null

  const code = await ensureReferralCodeForBusiness(referrerBusinessId)
  await syncReferralStages(admin, referrerBusinessId)

  const { data: referrals, error } = await admin
    .from("business_referrals")
    .select(
      "id, referral_code, stage, registered_at, trial_activated_at, paying_at, referred_business_id",
    )
    .eq("referrer_business_id", referrerBusinessId)
    .order("registered_at", { ascending: false })

  if (error) return null

  const businessIds = (referrals ?? []).map((r) => r.referred_business_id)
  const { data: profiles } =
    businessIds.length > 0
      ? await admin.from("business_profiles").select("id, business_name").in("id", businessIds)
      : { data: [] as Array<{ id: string; business_name: string }> }

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.business_name]))

  const history: ReferralDashboardRow[] = (referrals ?? []).map((row) => ({
    id: row.id,
    referralCode: row.referral_code,
    referredBusinessName: nameById.get(row.referred_business_id) ?? "—",
    stage: row.stage as ReferralConversionStage,
    registeredAt: row.registered_at,
    trialActivatedAt: row.trial_activated_at,
    payingAt: row.paying_at,
  }))

  const stats: ReferralDashboardStats = {
    registrations: history.length,
    trialActivated: history.filter((h) => h.stage === "trial_activated" || h.stage === "paying").length,
    paying: history.filter((h) => h.stage === "paying").length,
  }

  return { code, stats, history }
}
