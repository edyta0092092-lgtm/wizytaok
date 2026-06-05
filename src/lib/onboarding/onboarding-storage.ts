/**
 * @deprecated Postęp onboardingu jest w Supabase (`panel_onboarding_state`).
 * Ten moduł pozostaje tylko dla ewentualnego czyszczenia starych kluczy w przeglądarce.
 */

import type { OnboardingScope } from "@/lib/onboarding/onboarding-scope"
import { getOnboardingStepIds } from "@/lib/onboarding/onboarding-steps"

const completedPrefix = "pw_onboarding_completed_v3_"
const dismissedPrefix = "pw_onboarding_welcome_dismissed_v3_"
const restartPrefix = "pw_onboarding_restart_v3_"
const stepCompletedPrefix = "pw_onboarding_step_completed_v2_"

function scopeSuffix(scope: OnboardingScope): string {
  return `${scope.userId}_${scope.businessId}_${scope.track}`
}

/** Usuwa legacy klucze localStorage dla bieżącego scope (opcjonalne wywołanie po migracji na DB). */
export function clearLegacyOnboardingLocalStorage(scope: OnboardingScope): void {
  if (typeof window === "undefined") return
  try {
    const suffix = scopeSuffix(scope)
    const prefixes = [
      `${completedPrefix}${suffix}`,
      `${dismissedPrefix}${suffix}`,
      `${restartPrefix}${suffix}`,
      `${stepCompletedPrefix}${suffix}_`,
    ]
    const keysToRemove: string[] = []
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i)
      if (!key) continue
      if (prefixes.some((p) => key === p || key.startsWith(p))) {
        keysToRemove.push(key)
      }
    }
    for (const id of getOnboardingStepIds(scope.track === "admin")) {
      keysToRemove.push(`${stepCompletedPrefix}${suffix}_${id}`)
    }
    for (const key of keysToRemove) {
      window.localStorage.removeItem(key)
    }
  } catch {
    /* ignore */
  }
}
