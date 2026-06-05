import type { SupabaseClient } from "@supabase/supabase-js"

import {
  mergeStepsJson,
  splitStepsJson,
  type OnboardingStepsMeta,
} from "@/lib/onboarding/onboarding-state-meta"
import {
  getOnboardingStepIds,
  type OnboardingStepId,
} from "@/lib/onboarding/onboarding-steps"
import type { OnboardingScope } from "@/lib/onboarding/onboarding-scope"

export type MemberOnboardingRecord = {
  welcomeDismissed: boolean
  completed: boolean
  steps: Partial<Record<OnboardingStepId, boolean>>
  meta: OnboardingStepsMeta
}

function isMissingTableError(message: string | undefined): boolean {
  const msg = message?.toLowerCase() ?? ""
  return msg.includes("panel_onboarding_state") && msg.includes("does not exist")
}

export function emptyMemberOnboardingRecord(): MemberOnboardingRecord {
  return {
    welcomeDismissed: false,
    completed: false,
    steps: {},
    meta: { resumeStepId: null, restartPending: false },
  }
}

function parseRow(
  data: {
    welcome_dismissed_at: string | null
    completed_at: string | null
    steps: unknown
    track: string
  },
  scope: OnboardingScope,
): MemberOnboardingRecord {
  const rowTrack = data.track === "staff" ? "staff" : "admin"
  if (rowTrack !== scope.track) {
    return emptyMemberOnboardingRecord()
  }

  const stepIds = getOnboardingStepIds(scope.track === "admin")
  const { steps, meta } = splitStepsJson(data.steps, stepIds)

  return {
    welcomeDismissed: Boolean(data.welcome_dismissed_at),
    completed: Boolean(data.completed_at),
    steps,
    meta,
  }
}

/** Jedno lekkie zapytanie — stan onboardingu użytkownika w firmie. */
export async function loadMemberOnboardingRecord(
  client: SupabaseClient,
  scope: OnboardingScope,
): Promise<MemberOnboardingRecord> {
  const { data, error } = await client
    .from("panel_onboarding_state")
    .select("welcome_dismissed_at, completed_at, steps, track")
    .eq("user_id", scope.userId)
    .eq("business_id", scope.businessId)
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error.message)) {
      return emptyMemberOnboardingRecord()
    }
    throw error
  }

  if (!data) return emptyMemberOnboardingRecord()
  return parseRow(data, scope)
}

export type MemberOnboardingPatch = Partial<{
  welcomeDismissed: boolean
  completed: boolean
  steps: Partial<Record<OnboardingStepId, boolean>>
  meta: Partial<OnboardingStepsMeta>
  resetSteps?: boolean
}>

export function mergeMemberOnboardingRecord(
  current: MemberOnboardingRecord,
  patch: MemberOnboardingPatch,
): MemberOnboardingRecord {
  let welcomeDismissed = current.welcomeDismissed
  if (patch.welcomeDismissed === true) welcomeDismissed = true
  if (patch.welcomeDismissed === false) welcomeDismissed = false

  let completed = current.completed
  if (patch.completed === true) completed = true
  if (patch.completed === false) completed = false

  const mergedSteps = patch.resetSteps
    ? { ...(patch.steps ?? {}) }
    : { ...current.steps, ...(patch.steps ?? {}) }
  const mergedMeta: OnboardingStepsMeta = {
    resumeStepId:
      patch.meta?.resumeStepId !== undefined
        ? patch.meta.resumeStepId
        : current.meta.resumeStepId,
    restartPending:
      patch.meta?.restartPending !== undefined
        ? patch.meta.restartPending
        : current.meta.restartPending,
  }

  return {
    welcomeDismissed,
    completed,
    steps: mergedSteps,
    meta: mergedMeta,
  }
}

export async function saveMemberOnboardingRecord(
  client: SupabaseClient,
  scope: OnboardingScope,
  current: MemberOnboardingRecord,
  patch: MemberOnboardingPatch,
): Promise<MemberOnboardingRecord> {
  const next = mergeMemberOnboardingRecord(current, patch)

  const row = {
    user_id: scope.userId,
    business_id: scope.businessId,
    track: scope.track,
    welcome_dismissed_at: next.welcomeDismissed ? new Date().toISOString() : null,
    completed_at: next.completed ? new Date().toISOString() : null,
    steps: mergeStepsJson(next.steps, next.meta),
  }

  const { error } = await client.from("panel_onboarding_state").upsert(row, {
    onConflict: "user_id,business_id",
  })

  if (error) {
    if (isMissingTableError(error.message)) {
      return next
    }
    throw error
  }

  return next
}

export async function clearMemberOnboardingRecord(
  client: SupabaseClient,
  scope: OnboardingScope,
): Promise<MemberOnboardingRecord> {
  const empty = emptyMemberOnboardingRecord()
  return saveMemberOnboardingRecord(client, scope, empty, {
    welcomeDismissed: false,
    completed: false,
    resetSteps: true,
    steps: {},
    meta: { resumeStepId: null, restartPending: false },
  })
}
