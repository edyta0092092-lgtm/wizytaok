import type { User } from "@supabase/supabase-js"

export const CLIENT_ACCOUNT_TYPE = "client" as const

export function isClientAccountUser(user: User | null | undefined): boolean {
  if (!user) return false
  const raw = user.user_metadata?.account_type
  return raw === CLIENT_ACCOUNT_TYPE || raw === "customer"
}

export function isClientPortalPath(pathname: string): boolean {
  return pathname === "/konto" || pathname.startsWith("/konto/")
}

export function isClientPortalLoginPath(pathname: string): boolean {
  return pathname === "/konto/logowanie"
}

export function normalizeClientEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase()
}
