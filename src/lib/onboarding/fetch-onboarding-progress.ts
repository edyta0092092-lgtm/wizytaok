import type { SupabaseClient } from "@supabase/supabase-js"

import {
  emptyOnboardingProgress,
  type OnboardingStepId,
} from "@/lib/onboarding/onboarding-steps"

export type OnboardingProgress = Record<OnboardingStepId, boolean>

export type OnboardingProgressSnapshot = {
  progress: OnboardingProgress
  slug: string | null
  bookingPath: string | null
}

async function hasStaffServiceLink(
  client: SupabaseClient,
  businessId: string,
): Promise<boolean> {
  const { data: staffRows } = await client
    .from("staff_members")
    .select("id")
    .eq("business_id", businessId)
    .eq("is_active", true)
  const staffIds = (staffRows ?? []).map((r) => r.id).filter(Boolean)
  if (staffIds.length === 0) return false

  const { data: linked, error } = await client
    .from("staff_services")
    .select("staff_id, staff_member_id, service_id, business_id")
    .eq("business_id", businessId)
    .limit(20)

  if (!error && linked?.length) {
    return linked.some((row) => {
      const sid =
        (typeof row.staff_id === "string" && row.staff_id) ||
        (typeof row.staff_member_id === "string" && row.staff_member_id) ||
        ""
      return Boolean(sid && staffIds.includes(sid) && row.service_id)
    })
  }

  for (const staffId of staffIds.slice(0, 12)) {
    const byStaff = await client
      .from("staff_services")
      .select("service_id")
      .eq("staff_id", staffId)
      .limit(1)
    if (byStaff.data?.length) return true
    const byMember = await client
      .from("staff_services")
      .select("service_id")
      .eq("staff_member_id", staffId)
      .limit(1)
    if (byMember.data?.length) return true
  }

  return false
}

export async function fetchOnboardingProgress(
  client: SupabaseClient,
  businessId: string,
  siteOrigin?: string,
): Promise<OnboardingProgressSnapshot> {
  const progress = emptyOnboardingProgress()
  const bid = businessId.trim()
  if (!bid) {
    return { progress, slug: null, bookingPath: null }
  }

  const [
    { data: openRule },
    { count: staffCount },
    { count: serviceCount },
    staffServiceOk,
    { data: bp },
    { count: bookingCount },
  ] = await Promise.all([
    client
      .from("availability_rules")
      .select("id")
      .eq("business_id", bid)
      .eq("is_open", true)
      .limit(1)
      .maybeSingle(),
    client
      .from("staff_members")
      .select("id", { count: "exact", head: true })
      .eq("business_id", bid)
      .eq("is_active", true),
    client
      .from("services")
      .select("id", { count: "exact", head: true })
      .eq("business_id", bid)
      .eq("is_active", true),
    hasStaffServiceLink(client, bid),
    client.from("business_profiles").select("slug").eq("id", bid).maybeSingle(),
    client
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("business_id", bid),
  ])

  progress.working_hours = Boolean(openRule?.id)
  progress.team_member = (staffCount ?? 0) >= 1
  progress.service = (serviceCount ?? 0) >= 1
  progress.staff_service = staffServiceOk

  const slug = typeof bp?.slug === "string" ? bp.slug.trim() : ""
  progress.booking_page = slug.length > 0
  progress.first_visit = (bookingCount ?? 0) >= 1

  const origin =
    siteOrigin?.replace(/\/$/, "") ||
    (typeof window !== "undefined" ? window.location.origin.replace(/\/$/, "") : "")
  const bookingPath =
    slug && origin ? `${origin}/rezerwacje/${encodeURIComponent(slug)}` : null

  return { progress, slug: slug || null, bookingPath }
}
