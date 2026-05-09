import { createServerClient, type SetAllCookies } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"

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
  const code = requestUrl.searchParams.get("code")
  const trialParam = requestUrl.searchParams.get("trial")
  const requestedNext = safeInternalRedirectOrDashboard(
    requestUrl.searchParams.get("next") ?? requestUrl.searchParams.get("redirectTo")
  )

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
            cookieStore.set(name, value, options)
          )
        } catch {
          /* ignore when not mutable */
        }
      },
    },
  }) as SupabaseClient<Database>

  if (code) {
    await supabase.auth.exchangeCodeForSession(code)
    await prepareBusinessProfileForStartTrial()
  }

  let next = requestedNext
  const trialFromQuery = trialParam === "1" || trialParam?.toLowerCase() === "true"
  const trialFromCookie = trialCookie === "1" || trialCookie?.toLowerCase() === "true"
  if (trialFromQuery || trialFromCookie) {
    next = "/start-trial"
  } else if (next === "/dashboard") {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const rawTrialIntent = user?.user_metadata?.trial_intent
    const wantsTrial =
      rawTrialIntent === true ||
      rawTrialIntent === "true" ||
      rawTrialIntent === 1 ||
      rawTrialIntent === "1"
    if (wantsTrial) {
      next = "/start-trial"
    }
  }

  const response = NextResponse.redirect(new URL(next, origin))
  if (trialFromQuery || trialFromCookie) {
    response.cookies.set("wizytaok_trial_intent", "", {
      path: "/",
      maxAge: 0,
    })
  }
  return response
}
