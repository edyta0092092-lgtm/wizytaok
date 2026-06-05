/** Trasy wymagające zalogowania (panel + odzyskanie dostępu). */
const AUTH_REQUIRED_PREFIXES = [
  "/dashboard",
  "/appointments",
  "/schedule",
  "/services",
  "/team",
  "/availability",
  "/clients",
  "/klienci",
  "/statystyki",
  "/messages",
  "/marketing",
  "/templates",
  "/settings",
  "/account",
  "/guide",
  "/help",
  "/support",
  "/start-trial",
  "/subscription-required",
  "/activate-access",
] as const

/** Operacyjny panel — wymaga `trialing` lub `active`. */
const OPERATIONAL_PANEL_PREFIXES = [
  "/dashboard",
  "/appointments",
  "/schedule",
  "/services",
  "/team",
  "/availability",
  "/clients",
  "/klienci",
  "/statystyki",
  "/messages",
  "/marketing",
  "/templates",
  "/guide",
  "/help",
  "/support",
] as const

/** Dostęp bez aktywnej subskrypcji (płatność / komunikat). */
const BILLING_RECOVERY_PREFIXES = [
  "/start-trial",
  "/subscription-required",
  "/activate-access",
  "/settings",
] as const

/** Konto użytkownika (wylogowanie) bez aktywnej subskrypcji. */
const ACCOUNT_PATH = "/account"

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

function matchesAnyPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((p) => matchesPrefix(pathname, p))
}

export function isAuthRequiredPanelPath(pathname: string): boolean {
  return matchesAnyPrefix(pathname, AUTH_REQUIRED_PREFIXES)
}

export function isOperationalPanelPath(pathname: string): boolean {
  return matchesAnyPrefix(pathname, OPERATIONAL_PANEL_PREFIXES)
}

export function isBillingRecoveryPath(pathname: string): boolean {
  return matchesAnyPrefix(pathname, BILLING_RECOVERY_PREFIXES)
}

export function isAccountPath(pathname: string): boolean {
  return matchesPrefix(pathname, ACCOUNT_PATH)
}
