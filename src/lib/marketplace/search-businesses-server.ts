import { hasActiveBusinessAccessFromProfile } from "@/lib/billing/subscription-status"
import { buildMarketplaceListing } from "@/lib/marketplace/build-listing"
import { normalizeSearchToken } from "@/lib/marketplace/extract-city"
import type {
  MarketplaceListing,
  MarketplaceSearchFilters,
  MarketplaceServicePreview,
} from "@/lib/marketplace/types"
import { getServiceRoleClient } from "@/lib/supabase/service-role"

function mapServiceRow(row: {
  id: string
  business_id: string
  name: string
  description: string | null
  duration_minutes: number
  price: number
  currency: string
}): MarketplaceServicePreview {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    durationMinutes: row.duration_minutes,
    price: Number(row.price ?? 0),
    currency: row.currency ?? "PLN",
  }
}

export async function fetchMarketplaceListings(): Promise<MarketplaceListing[]> {
  const admin = getServiceRoleClient()
  if (!admin) return []

  const { data: businesses, error } = await admin
    .from("business_profiles")
    .select(
      "id,business_name,slug,business_address,phone,contact_phone,subscription_status,stripe_subscription_status,subscription_trial_ends_at",
    )
    .not("slug", "is", null)

  if (error || !businesses?.length) return []

  const activeBusinesses = businesses.filter((b) =>
    hasActiveBusinessAccessFromProfile({
      subscriptionStatus: b.subscription_status,
      stripeSubscriptionStatus: b.stripe_subscription_status,
      subscriptionTrialEndsAt: b.subscription_trial_ends_at,
    }),
  )

  const ids = activeBusinesses.map((b) => b.id)
  if (ids.length === 0) return []

  const { data: serviceRows } = await admin
    .from("services")
    .select("id,business_id,name,description,duration_minutes,price,currency")
    .in("business_id", ids)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  const servicesByBusiness = new Map<string, MarketplaceServicePreview[]>()
  for (const row of serviceRows ?? []) {
    const list = servicesByBusiness.get(row.business_id) ?? []
    list.push(mapServiceRow(row))
    servicesByBusiness.set(row.business_id, list)
  }

  return activeBusinesses
    .filter((b) => typeof b.slug === "string" && b.slug.trim().length > 0)
    .map((b) =>
      buildMarketplaceListing(
        {
          id: b.id,
          business_name: b.business_name,
          slug: b.slug,
          business_address: b.business_address,
          phone: b.phone,
          contact_phone: b.contact_phone,
        },
        servicesByBusiness.get(b.id) ?? [],
      ),
    )
    .filter((listing) => listing.services.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "pl"))
}

export function filterMarketplaceListings(
  listings: MarketplaceListing[],
  filters: MarketplaceSearchFilters,
): MarketplaceListing[] {
  const cityQ = normalizeSearchToken(filters.city ?? "")
  const companyQ = normalizeSearchToken(filters.companyName ?? "")
  const serviceQ = normalizeSearchToken(filters.service ?? "")
  const category = filters.category?.trim() || ""

  return listings.filter((listing) => {
    if (cityQ) {
      const city = normalizeSearchToken(listing.city ?? "")
      const addr = normalizeSearchToken(listing.address ?? "")
      if (!city.includes(cityQ) && !addr.includes(cityQ)) return false
    }
    if (companyQ && !normalizeSearchToken(listing.name).includes(companyQ)) return false
    if (category && category !== "all" && !listing.categoryIds.includes(category)) return false
    if (serviceQ) {
      const haystack = listing.services
        .map((s) => `${s.name} ${s.description ?? ""}`)
        .join(" ")
      if (!normalizeSearchToken(haystack).includes(serviceQ)) return false
    }
    return true
  })
}

export async function searchMarketplace(
  filters: MarketplaceSearchFilters,
): Promise<MarketplaceListing[]> {
  const all = await fetchMarketplaceListings()
  return filterMarketplaceListings(all, filters)
}

export async function listMarketplaceCities(): Promise<string[]> {
  const listings = await fetchMarketplaceListings()
  const cities = new Set<string>()
  for (const l of listings) {
    if (l.city?.trim()) cities.add(l.city.trim())
  }
  return [...cities].sort((a, b) => a.localeCompare(b, "pl"))
}
