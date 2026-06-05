import type { SupabaseClient } from "@supabase/supabase-js"

import { loadMemberOnboardingRecord } from "@/lib/onboarding/member-onboarding-db"
import {
  loadUserOnboardingFlags,
  mergeUserOnboardingSteps,
  type UserOnboardingFlags,
} from "@/lib/onboarding/persist-member-onboarding"
import { detectStaffServiceAssignment } from "@/lib/onboarding/detect-staff-service-assignment"
import { buildOnboardingScope } from "@/lib/onboarding/onboarding-scope"
import {
  emptyOnboardingProgress,
  getOnboardingStepIds,
  type OnboardingStepId,
} from "@/lib/onboarding/onboarding-steps"

export type OnboardingProgress = Record<OnboardingStepId, boolean>

export type OnboardingProgressSnapshot = {
  progress: OnboardingProgress
  slug: string | null
  bookingPath: string | null
  userFlags: UserOnboardingFlags
}

async function fetchBusinessBookingMeta(
  client: SupabaseClient,
  businessId: string,
  siteOrigin?: string,
): Promise<{ slug: string | null; bookingPath: string | null }> {
  const bid = businessId.trim()
  const { data: bp } = await client
    .from("business_profiles")
    .select("slug")
    .eq("id", bid)
    .maybeSingle()

  const slug = typeof bp?.slug === "string" ? bp.slug.trim() : ""
  const origin =
    siteOrigin?.replace(/\/$/, "") ||
    (typeof window !== "undefined" ? window.location.origin.replace(/\/$/, "") : "")
  const bookingPath =
    slug && origin ? `${origin}/rezerwacje/${encodeURIComponent(slug)}` : null

  return { slug: slug || null, bookingPath }
}

function buildProgressFromUserSteps(
  isAdmin: boolean,
  steps: Partial<Record<OnboardingStepId, boolean>>,
): OnboardingProgress {
  const base = emptyOnboardingProgress(isAdmin) as OnboardingProgress
  for (const id of getOnboardingStepIds(isAdmin)) {
    base[id] = Boolean(steps[id])
  }
  return base
}

export async function fetchOnboardingProgress(
  client: SupabaseClient,
  businessId: string,
  options: {
    isAdmin: boolean
    userId: string
    siteOrigin?: string
  },
): Promise<OnboardingProgressSnapshot> {
  const bid = businessId.trim()
  const scope = buildOnboardingScope(options.userId, bid, options.isAdmin)

  if (!bid || !scope) {
    return {
      progress: emptyOnboardingProgress(options.isAdmin) as OnboardingProgress,
      slug: null,
      bookingPath: null,
      userFlags: { welcomeDismissed: false, completed: false },
    }
  }

  let userSteps: Partial<Record<OnboardingStepId, boolean>> = {}
  try {
    const row = await loadMemberOnboardingRecord(client, scope)
    userSteps = row?.steps ?? {}
  } catch {
    userSteps = {}
  }

  const userFlags = await loadUserOnboardingFlags(client, scope)
  const mergedSteps = mergeUserOnboardingSteps(scope, userSteps)
  const progress = buildProgressFromUserSteps(options.isAdmin, mergedSteps)

  const { slug, bookingPath } = await fetchBusinessBookingMeta(client, bid, options.siteOrigin)

  return {
    progress,
    slug,
    bookingPath,
    userFlags,
  }
}

/** Podczas aktywnego przewodnika admina — zalicz krok, gdy firma spełnia warunek (tylko bieżący krok). */
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
