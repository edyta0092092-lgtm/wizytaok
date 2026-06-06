export type ReferralRewardTier = {
  tierCode: string
  requiredPayingReferrals: number
  freeMonths: number
  labelPl: string
  labelEn: string
}

/** Przygotowane progi nagród — bez automatycznego naliczania w Stripe. */
export const REFERRAL_REWARD_TIERS: readonly ReferralRewardTier[] = [
  {
    tierCode: "referrals_1",
    requiredPayingReferrals: 1,
    freeMonths: 1,
    labelPl: "1 płacące polecenie = 1 miesiąc gratis",
    labelEn: "1 paying referral = 1 free month",
  },
  {
    tierCode: "referrals_3",
    requiredPayingReferrals: 3,
    freeMonths: 3,
    labelPl: "3 płacące polecenia = 3 miesiące gratis",
    labelEn: "3 paying referrals = 3 free months",
  },
] as const

export type ReferralRewardEligibility = ReferralRewardTier & {
  eligible: boolean
  payingReferrals: number
}

export function computeReferralRewardEligibility(payingReferrals: number): ReferralRewardEligibility[] {
  return REFERRAL_REWARD_TIERS.map((tier) => ({
    ...tier,
    payingReferrals,
    eligible: payingReferrals >= tier.requiredPayingReferrals,
  }))
}
