import type { SupabaseClient } from "@supabase/supabase-js"

import { detectAdminBusinessStepReady } from "@/lib/onboarding/detect-admin-step-ready"
import {
  saveMemberOnboardingRecord,
  type MemberOnboardingRecord,
} from "@/lib/onboarding/member-onboarding-db"
import type { OnboardingScope } from "@/lib/onboarding/onboarding-scope"
import { getOnboardingStepIds, type OnboardingStepId } from "@/lib/onboarding/onboarding-steps"

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

/** Jednorazowe zaliczenie wybranych kroków na podstawie danych firmy (zapis do DB). */
export async function syncOnboardingStepsFromBusiness(
  client: SupabaseClient,
  businessId: string,
  scope: OnboardingScope,
  current: MemberOnboardingRecord,
  onlyStepIds?: OnboardingStepId[],
): Promise<MemberOnboardingRecord> {
  const ids = onlyStepIds ?? getOnboardingStepIds(scope.track === "admin")
  const toPersist: Partial<Record<OnboardingStepId, boolean>> = {}

  await Promise.all(
    ids.map(async (id) => {
      if (current.steps[id]) return
      const ready = await isStepDoneInBusiness(client, businessId, scope, id)
      if (!ready) return
      toPersist[id] = true
      if (id === "staff_appointments") {
        toPersist.staff_first_visit = true
      }
    }),
  )

  if (Object.keys(toPersist).length === 0) return current

  try {
    return await saveMemberOnboardingRecord(client, scope, current, { steps: toPersist })
  } catch {
    return {
      ...current,
      steps: { ...current.steps, ...toPersist },
    }
  }
}
