import { createServerClient, type SetAllCookies } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"

import { safeInternalRedirectOrDashboard } from "@/lib/auth/safe-internal-redirect"
import { ensureBusinessProfileFromUserMetadata } from "@/lib/supabase/ensure-profile-from-metadata"
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
  const requestedNext = safeInternalRedirectOrDashboard(
    requestUrl.searchParams.get("next") ?? requestUrl.searchParams.get("redirectTo")
  )

  const cookieStore = await cookies()

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
    await ensureBusinessProfileFromUserMetadata(supabase)
  }

  let next = requestedNext
  if (next === "/dashboard") {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const wantsTrial =
      typeof user?.user_metadata?.trial_intent === "boolean" && user.user_metadata.trial_intent
    if (wantsTrial) {
      next = "/start-trial"
    }
  }

  return NextResponse.redirect(new URL(next, origin))
}
