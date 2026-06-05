import type { SupabaseClient } from "@supabase/supabase-js"

import { detectStaffServiceAssignment } from "@/lib/onboarding/detect-staff-service-assignment"
import type { OnboardingStepId } from "@/lib/onboarding/onboarding-steps"

/** Czy firma spełnia warunek kroku admina (bez zapisu do profilu użytkownika). */
export async function detectAdminBusinessStepReady(
  client: SupabaseClient,
  businessId: string,
  stepId: OnboardingStepId,
): Promise<boolean> {
  const bid = businessId.trim()
  if (!bid) return false

  switch (stepId) {
    case "working_hours": {
      const { data } = await client
        .from("availability_rules")
        .select("id")
        .eq("business_id", bid)
        .eq("is_open", true)
        .limit(1)
        .maybeSingle()
      return Boolean(data?.id)
    }
    case "team_member": {
      const { count } = await client
        .from("staff_members")
        .select("id", { count: "exact", head: true })
        .eq("business_id", bid)
        .eq("is_active", true)
      return (count ?? 0) >= 1
    }
    case "service": {
      const { count } = await client
        .from("services")
        .select("id", { count: "exact", head: true })
        .eq("business_id", bid)
        .eq("is_active", true)
      return (count ?? 0) >= 1
    }
    case "staff_service":
      return detectStaffServiceAssignment(client, bid)
    case "booking_page": {
      const { data: bp } = await client
        .from("business_profiles")
        .select("slug")
        .eq("id", bid)
        .maybeSingle()
      const slug = typeof bp?.slug === "string" ? bp.slug.trim() : ""
      return slug.length > 0
    }
    case "first_visit": {
      const { count } = await client
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("business_id", bid)
      return (count ?? 0) >= 1
    }
    default:
      return false
  }
}
