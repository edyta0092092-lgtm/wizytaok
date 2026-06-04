/** Trasy panelu niedostępne dla roli „obsługa” (administrator i właściciel mają pełny dostęp). */
const STAFF_FORBIDDEN_PREFIXES = [
  "/team",
  "/services",
  "/availability",
  "/statystyki",
  "/templates",
] as const

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function isStaffForbiddenPanelPath(pathname: string): boolean {
  return STAFF_FORBIDDEN_PREFIXES.some((p) => matchesPrefix(pathname, p))
}
