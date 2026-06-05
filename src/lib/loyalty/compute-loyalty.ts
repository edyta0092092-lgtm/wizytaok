import type { CustomerCrmRow } from "@/lib/customers/customer-types"
import type {
  CustomerLoyaltyState,
  LoyaltyDashboardMetrics,
  LoyaltyProgramConfig,
} from "@/lib/loyalty/loyalty-types"
import type { LoyaltyRewardRecord } from "@/lib/loyalty/loyalty-types"

export function qualifyingVisitCount(row: CustomerCrmRow): number {
  return row.completedCount
}

export function computeCustomerPoints(
  row: CustomerCrmRow,
  program: LoyaltyProgramConfig,
): number {
  if (!program.enabled || program.kind !== "points") return 0
  const perVisit = Math.max(1, program.pointsPerCompletedVisit)
  return qualifyingVisitCount(row) * perVisit
}

export function computeCustomerLoyaltyState(
  row: CustomerCrmRow,
  program: LoyaltyProgramConfig,
  labels: {
    pointsUnit: string
    visitsProgress: (current: number, target: number) => string
    rewardReady: (percent: number) => string
    tierReached: (name: string) => string
    tierProgress: (current: number, target: number, name: string) => string
    inactive: string
  },
): CustomerLoyaltyState {
  const visits = qualifyingVisitCount(row)

  if (!program.enabled) {
    return {
      qualifyingVisits: visits,
      points: 0,
      levelLabel: labels.inactive,
      progressPercent: 0,
      eligibleForReward: false,
      tierReached: false,
    }
  }

  if (program.kind === "points") {
    const points = computeCustomerPoints(row, program)
    return {
      qualifyingVisits: visits,
      points,
      levelLabel: `${points} ${labels.pointsUnit}`,
      progressPercent: 100,
      eligibleForReward: points > 0,
      tierReached: false,
    }
  }

  if (program.kind === "vip_tier") {
    const target = Math.max(1, program.visitsForTier)
    const reached = visits >= target
    const progressPercent = Math.min(100, Math.round((visits / target) * 100))
    return {
      qualifyingVisits: visits,
      points: 0,
      levelLabel: reached
        ? labels.tierReached(program.tierName.trim() || "VIP")
        : labels.tierProgress(visits, target, program.tierName.trim() || "VIP"),
      progressPercent,
      eligibleForReward: reached,
      tierReached: reached,
    }
  }

  const target = Math.max(1, program.visitsForReward)
  const reached = visits >= target
  const progressPercent = Math.min(100, Math.round((visits / target) * 100))
  return {
    qualifyingVisits: visits,
    points: 0,
    levelLabel: reached
      ? labels.rewardReady(program.rewardPercent)
      : labels.visitsProgress(visits, target),
    progressPercent,
    eligibleForReward: reached,
    tierReached: false,
  }
}

export function computeLoyaltyDashboard(
  rows: CustomerCrmRow[],
  program: LoyaltyProgramConfig,
  rewards: LoyaltyRewardRecord[],
): LoyaltyDashboardMetrics {
  if (!program.enabled || rows.length === 0) {
    return {
      activeParticipants: 0,
      rewardsIssued: rewards.length,
      avgVisitsAmongParticipants: 0,
    }
  }

  const participants = rows.filter((r) => qualifyingVisitCount(r) > 0)
  const totalVisits = participants.reduce((sum, r) => sum + qualifyingVisitCount(r), 0)

  return {
    activeParticipants: participants.length,
    rewardsIssued: rewards.length,
    avgVisitsAmongParticipants:
      participants.length > 0
        ? Math.round((totalVisits / participants.length) * 10) / 10
        : 0,
  }
}
