/** Zakres onboardingu: jeden użytkownik w jednej firmie (ścieżka admin lub staff). */

export type OnboardingTrack = "admin" | "staff"

export type OnboardingScope = {
  userId: string
  businessId: string
  track: OnboardingTrack
}

export function buildOnboardingScope(
  userId: string,
  businessId: string,
  isAdmin: boolean,
): OnboardingScope | null {
  const uid = userId.trim()
  const bid = businessId.trim()
  if (!uid || !bid) return null
  return {
    userId: uid,
    businessId: bid,
    track: isAdmin ? "admin" : "staff",
  }
}
