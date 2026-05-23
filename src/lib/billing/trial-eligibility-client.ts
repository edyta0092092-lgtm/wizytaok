export type TrialEligibilityResponse = {
  ok?: boolean
  eligible?: boolean
  blocked?: boolean
  reason?: string
  message?: string | null
  hasBusinessProfile?: boolean
}

export async function fetchTrialStartEligibility(): Promise<{
  blocked: boolean
  message: string | null
  hasBusinessProfile: boolean
}> {
  try {
    const res = await fetch("/api/billing/trial-eligibility", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    })
    const payload = (await res.json()) as TrialEligibilityResponse
    if (!res.ok || payload.ok === false) {
      return { blocked: false, message: null, hasBusinessProfile: false }
    }
    return {
      blocked: Boolean(payload.blocked),
      message: typeof payload.message === "string" ? payload.message : null,
      hasBusinessProfile: Boolean(payload.hasBusinessProfile),
    }
  } catch {
    return { blocked: false, message: null, hasBusinessProfile: false }
  }
}
