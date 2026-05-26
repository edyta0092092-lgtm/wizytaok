/** Stan onboardingu w przeglądarce (bez migracji SQL). */

const completedPrefix = "pw_onboarding_completed_v2_"
const dismissedPrefix = "pw_onboarding_welcome_dismissed_v2_"
const restartPrefix = "pw_onboarding_restart_v2_"
const stepCompletedPrefix = "pw_onboarding_step_completed_v1_"

export type StoredOnboardingStepId = "booking_page"

export function onboardingCompletedKey(businessId: string): string {
  return `${completedPrefix}${businessId.trim()}`
}

export function onboardingWelcomeDismissedKey(businessId: string): string {
  return `${dismissedPrefix}${businessId.trim()}`
}

export function onboardingRestartKey(businessId: string): string {
  return `${restartPrefix}${businessId.trim()}`
}

export function onboardingStepCompletedKey(
  businessId: string,
  stepId: StoredOnboardingStepId,
): string {
  return `${stepCompletedPrefix}${businessId.trim()}_${stepId}`
}

export function isOnboardingMarkedComplete(businessId: string): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.localStorage.getItem(onboardingCompletedKey(businessId)) === "1"
  } catch {
    return false
  }
}

export function markOnboardingComplete(businessId: string): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(onboardingCompletedKey(businessId), "1")
    window.localStorage.removeItem(onboardingRestartKey(businessId))
  } catch {
    /* ignore */
  }
}

export function isOnboardingStepMarkedComplete(
  businessId: string,
  stepId: StoredOnboardingStepId,
): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.localStorage.getItem(onboardingStepCompletedKey(businessId, stepId)) === "1"
  } catch {
    return false
  }
}

export function markOnboardingStepComplete(
  businessId: string,
  stepId: StoredOnboardingStepId,
): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(onboardingStepCompletedKey(businessId, stepId), "1")
  } catch {
    /* ignore */
  }
}

function clearStoredOnboardingStepCompletions(businessId: string): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(onboardingStepCompletedKey(businessId, "booking_page"))
  } catch {
    /* ignore */
  }
}

export function isOnboardingWelcomeDismissed(businessId: string): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.localStorage.getItem(onboardingWelcomeDismissedKey(businessId)) === "1"
  } catch {
    return false
  }
}

export function markOnboardingWelcomeDismissed(businessId: string): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(onboardingWelcomeDismissedKey(businessId), "1")
  } catch {
    /* ignore */
  }
}

export function clearOnboardingWelcomeDismissed(businessId: string): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(onboardingWelcomeDismissedKey(businessId))
  } catch {
    /* ignore */
  }
}

export function requestOnboardingRestart(businessId: string): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(onboardingRestartKey(businessId), "1")
    window.localStorage.removeItem(onboardingCompletedKey(businessId))
    window.localStorage.removeItem(onboardingWelcomeDismissedKey(businessId))
    clearStoredOnboardingStepCompletions(businessId)
  } catch {
    /* ignore */
  }
}

export function consumeOnboardingRestart(businessId: string): boolean {
  if (typeof window === "undefined") return false
  try {
    const key = onboardingRestartKey(businessId)
    const v = window.localStorage.getItem(key) === "1"
    if (v) window.localStorage.removeItem(key)
    return v
  } catch {
    return false
  }
}
