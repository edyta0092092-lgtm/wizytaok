import type { SupabaseClient } from "@supabase/supabase-js"

import { safeInternalRedirect } from "@/lib/auth/safe-internal-redirect"
import type { Database } from "@/types/database"

export type OAuthProvider = "google" | "facebook"

export type OAuthSignInOptions = {
  /** Ścieżka po callback (np. /dashboard, /settings?setup=business). */
  next?: string | null
  /** Zachowaj intencję trial (cookie + param trial=1 w callback). */
  trialIntent?: boolean
}

export function buildOAuthCallbackUrl(options?: OAuthSignInOptions): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin.replace(/\/$/, "") : ""
  const params = new URLSearchParams()
  const next = safeInternalRedirect(options?.next ?? null)
  if (next) params.set("next", next)
  if (options?.trialIntent) params.set("trial", "1")
  const qs = params.toString()
  return `${origin}/auth/callback${qs ? `?${qs}` : ""}`
}

export function mapSignInWithOAuthError(message: string | undefined): string {
  const m = (message ?? "").trim().toLowerCase()
  if (!m) return "oauth_failed"
  if (m.includes("not enabled") || m.includes("provider is disabled")) {
    return "provider_not_enabled"
  }
  if (m.includes("cancel") || m.includes("access_denied")) {
    return "cancelled"
  }
  return "oauth_failed"
}

export function mapOAuthCallbackQueryError(
  error: string | null | undefined,
  description: string | null | undefined,
): string {
  const e = (error ?? "").trim().toLowerCase()
  const d = (description ?? "").trim().toLowerCase()
  if (e === "access_denied" || e.includes("cancel") || d.includes("cancel")) {
    return "cancelled"
  }
  if (d.includes("not enabled") || e.includes("provider") && d.includes("disabled")) {
    return "provider_not_enabled"
  }
  return "oauth_failed"
}

/**
 * Przekierowanie do Google / Facebook OAuth (PKCE). `redirectTo` wskazuje na /auth/callback.
 */
export async function signInWithOAuthProvider(
  client: SupabaseClient<Database>,
  provider: OAuthProvider,
  options?: OAuthSignInOptions,
): Promise<{ ok: true } | { ok: false; code: string; message?: string }> {
  const redirectTo = buildOAuthCallbackUrl(options)
  const { error } = await client.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: false,
    },
  })
  if (error) {
    return {
      ok: false,
      code: mapSignInWithOAuthError(error.message),
      message: error.message,
    }
  }
  return { ok: true }
}
