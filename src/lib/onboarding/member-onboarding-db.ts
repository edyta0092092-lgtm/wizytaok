import type { SupabaseClient } from "@supabase/supabase-js"

import {
  getOnboardingStepIds,
  type OnboardingStepId,
} from "@/lib/onboarding/onboarding-steps"
import type { OnboardingScope } from "@/lib/onboarding/onboarding-scope"

export type MemberOnboardingRecord = {
  welcomeDismissed: boolean
  completed: boolean
  steps: Partial<Record<OnboardingStepId, boolean>>
}

function stepsFromJson(
  raw: unknown,
  track: OnboardingScope["track"],
): Partial<Record<OnboardingStepId, boolean>> {
  if (!raw || typeof raw !== "object") return {}
  const ids = getOnboardingStepIds(track === "admin")
  const out: Partial<Record<OnboardingStepId, boolean>> = {}
  const o = raw as Record<string, unknown>
  for (const id of ids) {
    if (o[id] === true) out[id] = true
  }
  return out
}

function stepsToJson(steps: Partial<Record<OnboardingStepId, boolean>>): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  for (const [key, value] of Object.entries(steps)) {
    if (value) out[key] = true
  }
  return out
}

export async function loadMemberOnboardingRecord(
  client: SupabaseClient,
  scope: OnboardingScope,
): Promise<MemberOnboardingRecord | null> {
  const { data, error } = await client
    .from("panel_onboarding_state")
    .select("welcome_dismissed_at, completed_at, steps, track")
    .eq("user_id", scope.userId)
    .eq("business_id", scope.businessId)
    .maybeSingle()

  if (error) {
    const msg = error.message?.toLowerCase() ?? ""
    if (msg.includes("panel_onboarding_state") && msg.includes("does not exist")) {
      return null
    }
    throw error
  }

  if (!data) {
    return {
      welcomeDismissed: false,
      completed: false,
      steps: {},
    }
  }

  const rowTrack = data.track === "staff" ? "staff" : "admin"
  const steps = rowTrack === scope.track ? stepsFromJson(data.steps, scope.track) : {}

  return {
    welcomeDismissed: Boolean(data.welcome_dismissed_at),
    completed: Boolean(data.completed_at),
    steps,
  }
}

export async function upsertMemberOnboardingRecord(
  client: SupabaseClient,
  scope: OnboardingScope,
  patch: Partial<{
    welcomeDismissed: boolean
    completed: boolean
    steps: Partial<Record<OnboardingStepId, boolean>>
  }>,
): Promise<void> {
  const existing = await loadMemberOnboardingRecord(client, scope)

  let welcomeDismissed = existing?.welcomeDismissed ?? false
  if (patch.welcomeDismissed === true) welcomeDismissed = true
  if (patch.welcomeDismissed === false) welcomeDismissed = false

  let completed = existing?.completed ?? false
  if (patch.completed === true) completed = true
  if (patch.completed === false) completed = false

  const mergedSteps = { ...(existing?.steps ?? {}), ...(patch.steps ?? {}) }

  const row = {
    user_id: scope.userId,
    business_id: scope.businessId,
    track: scope.track,
    welcome_dismissed_at: welcomeDismissed ? new Date().toISOString() : null,
    completed_at: completed ? new Date().toISOString() : null,
    steps: stepsToJson(mergedSteps),
  }

  const { error } = await client.from("panel_onboarding_state").upsert(row, {
    onConflict: "user_id,business_id",
  })

  if (error) {
    const msg = error.message?.toLowerCase() ?? ""
    if (msg.includes("panel_onboarding_state") && msg.includes("does not exist")) {
      return
    }
    throw error
  }
}

export async function clearMemberOnboardingRecord(
  client: SupabaseClient,
  scope: OnboardingScope,
): Promise<void> {
  const { error } = await client.from("panel_onboarding_state").upsert(
    {
      user_id: scope.userId,
      business_id: scope.businessId,
      track: scope.track,
      welcome_dismissed_at: null,
      completed_at: null,
      steps: {},
    },
    { onConflict: "user_id,business_id" },
  )
  if (error) {
    const msg = error.message?.toLowerCase() ?? ""
    if (msg.includes("panel_onboarding_state") && msg.includes("does not exist")) {
      return
    }
    throw error
  }
}
