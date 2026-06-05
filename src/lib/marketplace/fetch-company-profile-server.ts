import { buildMarketplaceListing } from "@/lib/marketplace/build-listing"
import type {
  MarketplaceCompanyProfile,
  MarketplaceOpeningHour,
  MarketplaceServicePreview,
} from "@/lib/marketplace/types"
import { hasActiveBusinessAccessFromProfile } from "@/lib/billing/subscription-status"
import { getServiceRoleClient } from "@/lib/supabase/service-role"

function mapServiceRow(row: {
  id: string
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

export async function fetchMarketplaceCompanyProfile(
  slug: string,
): Promise<MarketplaceCompanyProfile | null> {
  const admin = getServiceRoleClient()
  if (!admin) return null

  const normalized = slug.trim().toLowerCase()
  const { data: business } = await admin
    .from("business_profiles")
    .select(
      "id,business_name,slug,business_address,phone,contact_phone,subscription_status,stripe_subscription_status,subscription_trial_ends_at",
    )
    .eq("slug", normalized)
    .maybeSingle()

  if (!business?.id) return null

  if (
    !hasActiveBusinessAccessFromProfile({
      subscriptionStatus: business.subscription_status,
      stripeSubscriptionStatus: business.stripe_subscription_status,
      subscriptionTrialEndsAt: business.subscription_trial_ends_at,
    })
  ) {
    return null
  }

  const [{ data: serviceRows }, { data: staffRows }, { data: hoursRows }] = await Promise.all([
    admin
      .from("services")
      .select("id,name,description,duration_minutes,price,currency")
      .eq("business_id", business.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    admin
      .from("staff_members")
      .select("id,name,role")
      .eq("business_id", business.id)
      .eq("is_active", true)
      .order("name", { ascending: true }),
    admin
      .from("availability_rules")
      .select("weekday,is_open,start_time,end_time")
      .eq("business_id", business.id)
      .order("weekday", { ascending: true }),
  ])

  const services = (serviceRows ?? []).map(mapServiceRow)
  const listing = buildMarketplaceListing(
    {
      id: business.id,
      business_name: business.business_name,
      slug: business.slug,
      business_address: business.business_address,
      phone: business.phone,
      contact_phone: business.contact_phone,
    },
    services,
  )

  const openingHours: MarketplaceOpeningHour[] = (hoursRows ?? []).map((row) => ({
    weekday: row.weekday,
    isOpen: Boolean(row.is_open),
    startTime: String(row.start_time ?? "").slice(0, 5),
    endTime: String(row.end_time ?? "").slice(0, 5),
  }))

  return {
    ...listing,
    staff: (staffRows ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      role: s.role,
    })),
    openingHours,
  }
}
