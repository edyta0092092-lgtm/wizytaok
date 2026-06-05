import type { CustomerCrmRow } from "@/lib/customers/customer-types"
import type { MarketingAudienceSegment } from "@/lib/marketing/marketing-types"

const INACTIVE_30_DAYS = 30
const INACTIVE_60_DAYS = 60

function daysSinceLastVisit(row: CustomerCrmRow, now: Date): number {
  if (!row.lastVisitAt) return Number.POSITIVE_INFINITY
  const ms = new Date(row.lastVisitAt).getTime()
  if (Number.isNaN(ms)) return Number.POSITIVE_INFINITY
  return (now.getTime() - ms) / 86_400_000
}

export function customerMatchesMarketingSegment(
  row: CustomerCrmRow,
  segment: MarketingAudienceSegment,
  now: Date = new Date(),
): boolean {
  switch (segment) {
    case "all":
      return true
    case "new":
      return row.segment === "new"
    case "returning":
      return row.segment === "returning" || row.segment === "loyal"
    case "inactive_30":
      return daysSinceLastVisit(row, now) >= INACTIVE_30_DAYS
    case "inactive_60":
      return daysSinceLastVisit(row, now) >= INACTIVE_60_DAYS
    case "cancelled_visit":
      return row.cancelledCount > 0
    case "no_show":
      return row.noShowCount > 0
    default:
      return false
  }
}

export function filterCustomersByMarketingSegment(
  rows: CustomerCrmRow[],
  segment: MarketingAudienceSegment,
): CustomerCrmRow[] {
  const now = new Date()
  const matched = rows.filter((row) => customerMatchesMarketingSegment(row, segment, now))

  const withContact =
    segment === "all"
      ? matched
      : matched.filter((row) => {
          if (segment === "inactive_30" || segment === "inactive_60") {
            return Boolean(row.phone.trim() || row.email.trim())
          }
          return true
        })

  const seen = new Set<string>()
  return withContact.filter((row) => {
    const key = row.id || `${row.phone}|${row.email}|${row.fullName}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export const MARKETING_AUDIENCE_SEGMENTS: MarketingAudienceSegment[] = [
  "all",
  "new",
  "returning",
  "inactive_30",
  "inactive_60",
  "cancelled_visit",
  "no_show",
]
