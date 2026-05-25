import { createServerClient, type SetAllCookies } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"

import {
  mapAuthCallbackExchangeError,
  mapOAuthCallbackQueryError,
} from "@/lib/auth/oauth-sign-in-client"
import {
  oauthErrorReturnPath,
  resolvePostAuthRedirect,
} from "@/lib/auth/resolve-post-auth-redirect-server"
import { safeInternalRedirectOrDashboard } from "@/lib/auth/safe-internal-redirect"
import { prepareBusinessProfileForStartTrial } from "@/lib/start-trial/prepare-business-profile-server"
import { isSupabaseConfigured } from "@/lib/supabase/server"
import { normalizeSupabaseUrl } from "@/lib/supabase/url"
import type { Database } from "@/types/database"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const origin = requestUrl.origin

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/login", origin))
  }

  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)!
  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )!.trim()

  const requestedNext = safeInternalRedirectOrDashboard(
    requestUrl.searchParams.get("next") ?? requestUrl.searchParams.get("redirectTo"),
  )

  const oauthError = requestUrl.searchParams.get("error")
  if (oauthError) {
    const code = mapOAuthCallbackQueryError(
      oauthError,
      requestUrl.searchParams.get("error_description"),
      requestUrl.searchParams.get("error_code"),
    )
    const returnPath = oauthErrorReturnPath(requestedNext)
    const dest = new URL(returnPath, origin)
    dest.searchParams.set("oauth_error", code)
    const nextPreserve = requestUrl.searchParams.get("next")
    if (nextPreserve) dest.searchParams.set("next", nextPreserve)
    return NextResponse.redirect(dest)
  }

  const code = requestUrl.searchParams.get("code")
  const trialParam = requestUrl.searchParams.get("trial")
  const cookieStore = await cookies()
  const trialCookie = cookieStore.get("wizytaok_trial_intent")?.value

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          )
        } catch {
          /* ignore when not mutable */
        }
      },
    },
  }) as SupabaseClient<Database>

  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (exchangeError) {
      const returnPath = oauthErrorReturnPath(requestedNext)
      const dest = new URL(returnPath, origin)
      dest.searchParams.set("oauth_error", mapAuthCallbackExchangeError(exchangeError.message))
      const nextPreserve = requestUrl.searchParams.get("next")
      if (nextPreserve) dest.searchParams.set("next", nextPreserve)
      return NextResponse.redirect(dest)
    }

    const prepare = await prepareBusinessProfileForStartTrial()
    if (prepare.ok === false && prepare.error === "missing_account_type") {
      /* OAuth / brak metadanych z formularza — profil uzupełnia się w /settings?setup=business */
    }
  }

  const trialFromQuery = trialParam === "1" || trialParam?.toLowerCase() === "true"
  const trialFromCookie = trialCookie === "1" || trialCookie?.toLowerCase() === "true"

  const next = await resolvePostAuthRedirect(supabase, requestedNext, {
    trialFromCookie: trialFromQuery || trialFromCookie,
  })

  const response = NextResponse.redirect(new URL(next, origin))
  if (trialFromQuery || trialFromCookie) {
    response.cookies.set("wizytaok_trial_intent", "", {
      path: "/",
      maxAge: 0,
    })
  }
  return response
}
