import type { SupabaseClient } from "@supabase/supabase-js"

import { detectAdminBusinessStepReady } from "@/lib/onboarding/fetch-onboarding-progress"
import { upsertMemberOnboardingRecord } from "@/lib/onboarding/member-onboarding-db"
import type { OnboardingScope } from "@/lib/onboarding/onboarding-scope"
import type { OnboardingProgress } from "@/lib/onboarding/fetch-onboarding-progress"
import { getOnboardingStepIds, type OnboardingStepId } from "@/lib/onboarding/onboarding-steps"
import { markOnboardingStepComplete } from "@/lib/onboarding/onboarding-storage"

async function detectStaffBusinessStepReady(
  client: SupabaseClient,
  businessId: string,
  stepId: OnboardingStepId,
): Promise<boolean> {
  const bid = businessId.trim()
  if (!bid) return false

  switch (stepId) {
    case "staff_appointments":
    case "staff_first_visit":
    case "staff_schedule": {
      const { count } = await client
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("business_id", bid)
      return (count ?? 0) >= 1
    }
    case "staff_messages": {
      const { count } = await client
        .from("notification_logs")
        .select("id", { count: "exact", head: true })
        .eq("business_id", bid)
      return (count ?? 0) >= 1
    }
    default:
      return false
  }
}

async function isStepDoneInBusiness(
  client: SupabaseClient,
  businessId: string,
  scope: OnboardingScope,
  stepId: OnboardingStepId,
): Promise<boolean> {
  if (scope.track === "admin") {
    return detectAdminBusinessStepReady(client, businessId, stepId)
  }
  return detectStaffBusinessStepReady(client, businessId, stepId)
}

/** Zapisuje w profilu użytkownika kroki już spełnione w firmie (bez auto-nawigacji). */
export async function syncOnboardingStepsFromBusiness(
  client: SupabaseClient,
  businessId: string,
  scope: OnboardingScope,
  progress: OnboardingProgress,
): Promise<OnboardingProgress> {
  const ids = getOnboardingStepIds(scope.track === "admin")
  const next = { ...progress }
  const toPersist: Partial<Record<OnboardingStepId, boolean>> = {}

  await Promise.all(
    ids.map(async (id) => {
      if (next[id]) return
      const ready = await isStepDoneInBusiness(client, businessId, scope, id)
      if (!ready) return
      next[id] = true
      toPersist[id] = true
      if (id === "staff_appointments") {
        next.staff_first_visit = true
        toPersist.staff_first_visit = true
      }
    }),
  )

  if (Object.keys(toPersist).length === 0) return next

  try {
    await upsertMemberOnboardingRecord(client, scope, { steps: toPersist })
    for (const id of Object.keys(toPersist) as OnboardingStepId[]) {
      markOnboardingStepComplete(scope, id)
    }
  } catch {
    /* brak tabeli / offline */
  }

  return next
}
