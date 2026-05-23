import { TOUR_STEPS } from "@/lib/guide/tour-steps"
import { isOperationalPanelPath } from "@/lib/auth/panel-paths"

/**
 * Onboarding (welcome modal + guided tour) tylko dla zalogowanej firmy z aktywnym
 * trialem/subskrypcją na trasach operacyjnego panelu. Publiczne strony nigdy.
 */
const PUBLIC_TOUR_BLOCKED_PREFIXES = [
  "/",
  "/login",
  "/signup",
  "/signup-staff",
  "/auth",
  "/start-trial",
  "/activate-access",
  "/subscription-required",
  "/rezerwacje",
  "/confirm",
  "/accept-invite",
  "/reset-password",
  "/pricing",
  "/cennik",
  "/landing",
  "/privacy",
  "/terms",
  "/developer-contact",
] as const

const TOUR_STEP_PATHS = new Set(TOUR_STEPS.map((step) => step.path))

function normalizePathname(pathname: string | null | undefined): string {
  if (!pathname) return ""
  const trimmed = pathname.trim()
  if (!trimmed || trimmed === "/") return "/"
  return trimmed.endsWith("/") && trimmed.length > 1
    ? trimmed.slice(0, -1)
    : trimmed
}

function matchesPrefix(pathname: string, prefix: string): boolean {
  if (prefix === "/") return pathname === "/"
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

/** Strony publiczne / marketing / auth — nigdy welcome ani tour. */
export function isPublicTourBlockedPath(pathname: string | null | undefined): boolean {
  const path = normalizePathname(pathname)
  if (!path) return true
  return PUBLIC_TOUR_BLOCKED_PREFIXES.some((prefix) => matchesPrefix(path, prefix))
}

/** @deprecated Użyj {@link isPublicTourBlockedPath}. */
export function isTourExcludedPublicPath(pathname: string | null | undefined): boolean {
  return isPublicTourBlockedPath(pathname)
}

/** Pierwszy welcome — tylko operacyjny panel (np. /dashboard, /appointments). */
export function isPanelWelcomePath(pathname: string | null | undefined): boolean {
  const path = normalizePathname(pathname)
  if (!path || isPublicTourBlockedPath(path)) return false
  return isOperationalPanelPath(path)
}

/** Automatyczny modal welcome — wyłącznie /dashboard po świeżej aktywacji dostępu. */
export function isPanelWelcomePopupPath(pathname: string | null | undefined): boolean {
  const path = normalizePathname(pathname)
  if (!path || isPublicTourBlockedPath(path)) return false
  return path === "/dashboard"
}

/** Trasy panelu + kroki przewodnika (np. /settings podczas aktywnego tour). */
export function isTourNavigationPath(pathname: string | null | undefined): boolean {
  const path = normalizePathname(pathname)
  if (!path || isPublicTourBlockedPath(path)) return false
  if (isOperationalPanelPath(path)) return true
  return TOUR_STEP_PATHS.has(path)
}

/** @deprecated Negacja publicznych — zbyt szerokie (łapało `/`). Użyj {@link isPanelWelcomePath}. */
export function isPanelTourPath(pathname: string | null | undefined): boolean {
  return isPanelWelcomePath(pathname)
}
