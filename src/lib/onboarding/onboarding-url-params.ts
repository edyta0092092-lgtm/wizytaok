/** Parametry URL dla onboardingu na /dashboard. */

export type OnboardingUrlAction = "welcome" | "resume"

export function readOnboardingUrlAction(): OnboardingUrlAction | null {
  if (typeof window === "undefined") return null
  const value = new URLSearchParams(window.location.search).get("onboarding")?.trim()
  if (value === "welcome" || value === "resume") return value
  return null
}

export function stripOnboardingSearchParam(pathname: string, search: string): string {
  const params = new URLSearchParams(search)
  params.delete("onboarding")
  const qs = params.toString()
  return `${pathname}${qs ? `?${qs}` : ""}`
}
