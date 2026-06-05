import type { SupabaseClient } from "@supabase/supabase-js"

import {
  clearMemberOnboardingRecord,
  loadMemberOnboardingRecord,
  upsertMemberOnboardingRecord,
} from "@/lib/onboarding/member-onboarding-db"
import type { OnboardingScope } from "@/lib/onboarding/onboarding-scope"
import type { OnboardingStepId } from "@/lib/onboarding/onboarding-steps"
import {
  isOnboardingMarkedComplete,
  isOnboardingStepMarkedComplete,
  isOnboardingWelcomeDismissed,
  markOnboardingComplete,
  markOnboardingStepComplete,
  markOnboardingWelcomeDismissed,
  readLocalOnboardingSteps,
} from "@/lib/onboarding/onboarding-storage"

export async function persistOnboardingWelcomeDismissed(
  client: SupabaseClient | null,
  scope: OnboardingScope,
): Promise<void> {
  markOnboardingWelcomeDismissed(scope)
  if (!client) return
  try {
    await upsertMemberOnboardingRecord(client, scope, { welcomeDismissed: true })
  } catch {
    /* offline / brak migracji */
  }
}

export async function persistOnboardingComplete(
  client: SupabaseClient | null,
  scope: OnboardingScope,
): Promise<void> {
  markOnboardingComplete(scope)
  if (!client) return
  try {
    await upsertMemberOnboardingRecord(client, scope, { completed: true })
  } catch {
    /* ignore */
  }
}

export async function persistOnboardingStepComplete(
  client: SupabaseClient | null,
  scope: OnboardingScope,
  stepId: OnboardingStepId,
): Promise<void> {
  markOnboardingStepComplete(scope, stepId)
  if (!client) return
  try {
    await upsertMemberOnboardingRecord(client, scope, {
      steps: { [stepId]: true },
    })
  } catch {
    /* ignore */
  }
}

export async function persistOnboardingRestart(
  client: SupabaseClient | null,
  scope: OnboardingScope,
): Promise<void> {
  if (!client) return
  try {
    await clearMemberOnboardingRecord(client, scope)
  } catch {
    /* ignore */
  }
}

export type UserOnboardingFlags = {
  welcomeDismissed: boolean
  completed: boolean
}

export async function loadUserOnboardingFlags(
  client: SupabaseClient | null,
  scope: OnboardingScope,
): Promise<UserOnboardingFlags> {
  let welcomeDismissed = isOnboardingWelcomeDismissed(scope)
  let completed = isOnboardingMarkedComplete(scope)

  if (client) {
    try {
      const row = await loadMemberOnboardingRecord(client, scope)
      if (row) {
        welcomeDismissed = welcomeDismissed || row.welcomeDismissed
        completed = completed || row.completed
      }
    } catch {
      /* ignore */
    }
  }

  return { welcomeDismissed, completed }
}

export function mergeUserOnboardingSteps(
  scope: OnboardingScope,
  fromDb: Partial<Record<OnboardingStepId, boolean>>,
): Partial<Record<OnboardingStepId, boolean>> {
  const local = readLocalOnboardingSteps(scope)
  const merged = { ...fromDb }
  for (const [id, done] of Object.entries(local)) {
    if (done) merged[id as OnboardingStepId] = true
  }
  for (const id of Object.keys(merged) as OnboardingStepId[]) {
    if (isOnboardingStepMarkedComplete(scope, id)) merged[id] = true
  }
  return merged
}
