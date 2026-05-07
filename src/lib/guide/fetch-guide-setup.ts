import type { SupabaseClient } from "@supabase/supabase-js"

export const GUIDE_SETUP_STEP_IDS = [
  "business",
  "services",
  "availability",
  "team",
  "public_page",
  "test_booking",
] as const

export type GuideSetupStepId = (typeof GUIDE_SETUP_STEP_IDS)[number]

export type GuideSetupAutoProgress = Record<GuideSetupStepId, boolean>

function emptyProgress(): GuideSetupAutoProgress {
  return {
    business: false,
    services: false,
    availability: false,
    team: false,
    public_page: false,
    test_booking: false,
  }
}

export async function fetchGuideSetupAutoProgress(
  client: SupabaseClient,
  ownerUserId: string
): Promise<{
  businessId: string | null
  slug: string | null
  auto: GuideSetupAutoProgress
}> {
  const auto = emptyProgress()

  const { data: bp } = await client
    .from("business_profiles")
    .select("id, business_name, email, phone, slug")
    .eq("owner_id", ownerUserId)
    .maybeSingle()

  if (!bp?.id) {
    return { businessId: null, slug: null, auto }
  }

  const bid = bp.id
  const slug = typeof bp.slug === "string" ? bp.slug.trim() : ""

  auto.business = Boolean(
    bp.business_name?.trim() && (bp.email?.trim() || bp.phone?.trim()) && slug.length > 0
  )

  const { count: svcCount } = await client
    .from("services")
    .select("id", { count: "exact", head: true })
    .eq("business_id", bid)
    .eq("is_active", true)

  auto.services = (svcCount ?? 0) >= 1

  const { data: openRule } = await client
    .from("availability_rules")
    .select("id")
    .eq("business_id", bid)
    .eq("is_open", true)
    .limit(1)
    .maybeSingle()

  auto.availability = Boolean(openRule)

  const { count: staffCount } = await client
    .from("staff_members")
    .select("id", { count: "exact", head: true })
    .eq("business_id", bid)
    .eq("is_active", true)

  auto.team = (staffCount ?? 0) >= 1

  auto.public_page = slug.length > 0

  const { count: onlineCount } = await client
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("business_id", bid)
    .eq("source", "online")

  auto.test_booking = (onlineCount ?? 0) >= 1

  return { businessId: bid, slug: slug.length > 0 ? slug : null, auto }
}
