/** Trasy przypisane do zakładki „Więcej” (podświetlenie w bottom nav). */
export const MOBILE_MORE_NAV_PATHS = [
  "/more",
  "/schedule",
  "/services",
  "/team",
  "/availability",
  "/statystyki",
  "/settings",
  "/activate-access",
  "/subscription-required",
  "/help",
  "/guide",
  "/account",
] as const

export function isMobileMoreNavActive(pathname: string): boolean {
  return MOBILE_MORE_NAV_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  )
}

export function isMobileBottomNavActive(pathname: string, href: string): boolean {
  if (href === "/more") return isMobileMoreNavActive(pathname)
  if (href === "/dashboard") return pathname === "/dashboard"
  return pathname === href || pathname.startsWith(`${href}/`)
}
