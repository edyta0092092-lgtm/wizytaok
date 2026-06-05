import type { CustomerSegment } from "@/lib/customers/customer-types"

const LOST_INACTIVE_DAYS = 90
const LOYAL_MIN_VISITS = 5
const LOYAL_RECENT_DAYS = 120

export function computeCustomerSegment(args: {
  visitCount: number
  lastVisitAt: string | null
  nextVisitAt: string | null
  now?: Date
}): CustomerSegment {
  const now = args.now ?? new Date()
  const { visitCount, lastVisitAt, nextVisitAt } = args

  if (visitCount <= 1) return "new"

  const lastMs = lastVisitAt ? new Date(lastVisitAt).getTime() : NaN
  const daysSinceLast =
    Number.isFinite(lastMs) ? (now.getTime() - lastMs) / 86_400_000 : Number.POSITIVE_INFINITY

  if (!nextVisitAt && daysSinceLast > LOST_INACTIVE_DAYS) return "lost"

  if (visitCount >= LOYAL_MIN_VISITS && daysSinceLast <= LOYAL_RECENT_DAYS) return "loyal"

  if (visitCount >= 2 && daysSinceLast <= LOST_INACTIVE_DAYS) return "returning"

  if (daysSinceLast > LOST_INACTIVE_DAYS) return "lost"

  return "returning"
}
