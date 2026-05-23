/**
 * Onboarding (welcome modal + guided tour) tylko w panelu zalogowanego użytkownika.
 * Publiczne strony klienta (link z SMS/e-mail) nie mogą pokazywać przewodnika.
 */
const TOUR_EXCLUDED_PREFIXES = [
  "/confirm",
  "/rezerwacje",
  "/login",
  "/signup",
  "/signup-staff",
  "/activate-access",
  "/subscription-required",
  "/start-trial",
  "/auth",
  "/accept-invite",
] as const

export function isTourExcludedPublicPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return TOUR_EXCLUDED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

export function isPanelTourPath(pathname: string | null | undefined): boolean {
  return !isTourExcludedPublicPath(pathname)
}
