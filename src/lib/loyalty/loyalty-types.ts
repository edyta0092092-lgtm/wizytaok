/** Rodzaj programu lojalnościowego (MVP — konfiguracja w przeglądarce). */
export type LoyaltyProgramKind = "visits_reward" | "points" | "vip_tier"

export type LoyaltyProgramConfig = {
  businessId: string
  enabled: boolean
  kind: LoyaltyProgramKind
  /** Wizyty do nagrody procentowej (typ A). */
  visitsForReward: number
  rewardPercent: number
  /** Punkty za każdą zakończoną wizytę (typ B — do czasu naliczania z PLN w bazie). */
  pointsPerCompletedVisit: number
  /** Wizyty do statusu VIP (typ C). */
  visitsForTier: number
  tierName: string
  updatedAt: string
}

export type LoyaltyRewardRecord = {
  id: string
  businessId: string
  clientId: string
  clientName: string
  programKind: LoyaltyProgramKind
  label: string
  issuedAt: string
  visitsAtIssue: number
  pointsAtIssue: number
}

export type CustomerLoyaltyState = {
  qualifyingVisits: number
  points: number
  levelLabel: string
  progressPercent: number
  eligibleForReward: boolean
  tierReached: boolean
}

export type LoyaltyDashboardMetrics = {
  activeParticipants: number
  rewardsIssued: number
  avgVisitsAmongParticipants: number
}
