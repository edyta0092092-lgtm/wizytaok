import { resolveEffectiveSubscriptionStatus } from "@/lib/billing/subscription-status"

export type ReferralConversionStage = "registered" | "trial_activated" | "paying"

export type ReferredBusinessBillingSnapshot = {
  subscription_status: string | null
  stripe_subscription_status: string | null
  subscription_trial_ends_at: string | null
  trial_started_at: string | null
  trial_used_at: string | null
}

export function computeReferralStage(profile: ReferredBusinessBillingSnapshot): ReferralConversionStage {
  const status = resolveEffectiveSubscriptionStatus(
    profile.subscription_status,
    profile.stripe_subscription_status,
  )

  if (status === "active") {
    return "paying"
  }

  const trialStarted = Boolean(profile.trial_started_at?.trim() || profile.trial_used_at?.trim())
  if (status === "trialing" || trialStarted) {
    return "trial_activated"
  }

  const trialEndRaw = profile.subscription_trial_ends_at?.trim()
  if (trialEndRaw) {
    const trialEndMs = Date.parse(trialEndRaw)
    if (!Number.isNaN(trialEndMs) && trialEndMs > Date.now()) {
      return "trial_activated"
    }
  }

  return "registered"
}

const STAGE_RANK: Record<ReferralConversionStage, number> = {
  registered: 0,
  trial_activated: 1,
  paying: 2,
}

export function referralStageAtLeast(
  current: ReferralConversionStage,
  target: ReferralConversionStage,
): boolean {
  return STAGE_RANK[current] >= STAGE_RANK[target]
}
