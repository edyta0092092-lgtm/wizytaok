/** Stan onboardingu w przeglądarce (per użytkownik + firma). Supabase: panel_onboarding_state. */

import type { OnboardingScope } from "@/lib/onboarding/onboarding-scope"
import { getOnboardingStepIds } from "@/lib/onboarding/onboarding-steps"

const completedPrefix = "pw_onboarding_completed_v3_"
const dismissedPrefix = "pw_onboarding_welcome_dismissed_v3_"
const restartPrefix = "pw_onboarding_restart_v3_"
const stepCompletedPrefix = "pw_onboarding_step_completed_v2_"

export type StoredOnboardingStepId = string

function scopeSuffix(scope: OnboardingScope): string {
  return `${scope.userId}_${scope.businessId}_${scope.track}`
}

export function onboardingCompletedKey(scope: OnboardingScope): string {
  return `${completedPrefix}${scopeSuffix(scope)}`
}

export function onboardingWelcomeDismissedKey(scope: OnboardingScope): string {
  return `${dismissedPrefix}${scopeSuffix(scope)}`
}

export function onboardingRestartKey(scope: OnboardingScope): string {
  return `${restartPrefix}${scopeSuffix(scope)}`
}

export function onboardingStepCompletedKey(
  scope: OnboardingScope,
  stepId: StoredOnboardingStepId,
): string {
  return `${stepCompletedPrefix}${scopeSuffix(scope)}_${stepId}`
}

export function isOnboardingMarkedComplete(scope: OnboardingScope): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.localStorage.getItem(onboardingCompletedKey(scope)) === "1"
  } catch {
    return false
  }
}

export function markOnboardingComplete(scope: OnboardingScope): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(onboardingCompletedKey(scope), "1")
    window.localStorage.removeItem(onboardingRestartKey(scope))
  } catch {
    /* ignore */
  }
}

export function isOnboardingStepMarkedComplete(
  scope: OnboardingScope,
  stepId: StoredOnboardingStepId,
): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.localStorage.getItem(onboardingStepCompletedKey(scope, stepId)) === "1"
  } catch {
    return false
  }
}

export function markOnboardingStepComplete(
  scope: OnboardingScope,
  stepId: StoredOnboardingStepId,
): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(onboardingStepCompletedKey(scope, stepId), "1")
  } catch {
    /* ignore */
  }
}

function clearStoredOnboardingStepCompletions(scope: OnboardingScope): void {
  if (typeof window === "undefined") return
  try {
    const prefix = `${stepCompletedPrefix}${scopeSuffix(scope)}_`
    const keysToRemove: string[] = []
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i)
      if (key?.startsWith(prefix)) keysToRemove.push(key)
    }
    for (const key of keysToRemove) {
      window.localStorage.removeItem(key)
    }
  } catch {
    /* ignore */
  }
}

export function isOnboardingWelcomeDismissed(scope: OnboardingScope): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.localStorage.getItem(onboardingWelcomeDismissedKey(scope)) === "1"
  } catch {
    return false
  }
}

export function markOnboardingWelcomeDismissed(scope: OnboardingScope): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(onboardingWelcomeDismissedKey(scope), "1")
  } catch {
    /* ignore */
  }
}

export function clearOnboardingWelcomeDismissed(scope: OnboardingScope): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(onboardingWelcomeDismissedKey(scope))
  } catch {
    /* ignore */
  }
}

export function requestOnboardingRestart(scope: OnboardingScope): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(onboardingRestartKey(scope), "1")
    window.localStorage.removeItem(onboardingCompletedKey(scope))
    window.localStorage.removeItem(onboardingWelcomeDismissedKey(scope))
    clearStoredOnboardingStepCompletions(scope)
  } catch {
    /* ignore */
  }
}

export function consumeOnboardingRestart(scope: OnboardingScope): boolean {
  if (typeof window === "undefined") return false
  try {
    const key = onboardingRestartKey(scope)
    const v = window.localStorage.getItem(key) === "1"
    if (v) window.localStorage.removeItem(key)
    return v
  } catch {
    return false
  }
}

/** Odczyt lokalnych kroków (bez flag welcome/complete). */
export function readLocalOnboardingSteps(
  scope: OnboardingScope,
): Partial<Record<string, boolean>> {
  const ids = getOnboardingStepIds(scope.track === "admin")
  const out: Partial<Record<string, boolean>> = {}
  for (const id of ids) {
    if (isOnboardingStepMarkedComplete(scope, id)) out[id] = true
  }
  return out
}
