import type { OnboardingStepId } from "@/lib/onboarding/onboarding-steps"

/** Klucze meta w kolumnie steps (jsonb) — nie są krokami checklisty. */
export const ONBOARDING_META_RESUME_STEP = "_resumeStepId"
export const ONBOARDING_META_RESTART_PENDING = "_restartPending"

export type OnboardingStepsMeta = {
  resumeStepId: OnboardingStepId | null
  restartPending: boolean
}

export function splitStepsJson(
  raw: unknown,
  validStepIds: readonly OnboardingStepId[],
): {
  steps: Partial<Record<OnboardingStepId, boolean>>
  meta: OnboardingStepsMeta
} {
  const steps: Partial<Record<OnboardingStepId, boolean>> = {}
  let resumeStepId: OnboardingStepId | null = null
  let restartPending = false

  if (!raw || typeof raw !== "object") {
    return { steps, meta: { resumeStepId, restartPending } }
  }

  const o = raw as Record<string, unknown>
  const valid = new Set<string>(validStepIds)

  for (const [key, value] of Object.entries(o)) {
    if (key === ONBOARDING_META_RESUME_STEP) {
      if (typeof value === "string" && valid.has(value)) {
        resumeStepId = value as OnboardingStepId
      }
      continue
    }
    if (key === ONBOARDING_META_RESTART_PENDING) {
      restartPending = value === true
      continue
    }
    if (valid.has(key) && value === true) {
      steps[key as OnboardingStepId] = true
    }
  }

  return { steps, meta: { resumeStepId, restartPending } }
}

export function mergeStepsJson(
  steps: Partial<Record<OnboardingStepId, boolean>>,
  meta: OnboardingStepsMeta,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [id, done] of Object.entries(steps)) {
    if (done) out[id] = true
  }
  if (meta.resumeStepId) {
    out[ONBOARDING_META_RESUME_STEP] = meta.resumeStepId
  }
  if (meta.restartPending) {
    out[ONBOARDING_META_RESTART_PENDING] = true
  }
  return out
}
