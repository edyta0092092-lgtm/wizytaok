import type { User } from "@supabase/supabase-js"

export const CHANGE_PASSWORD_PATH = "/reset-password"

export function userMustChangePassword(user: User | null | undefined): boolean {
  if (!user) return false
  const raw = user.user_metadata?.must_change_password
  return raw === true || raw === "true" || raw === 1 || raw === "1"
}

export function isChangePasswordExemptPath(pathname: string): boolean {
  if (pathname === CHANGE_PASSWORD_PATH) return true
  if (pathname.startsWith("/auth/")) return true
  if (pathname === "/login" || pathname === "/signup" || pathname === "/signup-staff") return true
  if (pathname.startsWith("/accept-invite/")) return true
  return false
}

export function changePasswordRequiredUrl(nextPath?: string | null): string {
  const url = new URL(CHANGE_PASSWORD_PATH, "http://local")
  url.searchParams.set("required", "1")
  const next = nextPath?.trim()
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    url.searchParams.set("next", next)
  }
  return `${url.pathname}${url.search}`
}
