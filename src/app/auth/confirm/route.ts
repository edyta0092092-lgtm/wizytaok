import { NextResponse } from "next/server"

import {
  oauthErrorReturnPath,
  resolvePostAuthRedirect,
} from "@/lib/auth/resolve-post-auth-redirect-server"
import { safeInternalRedirectOrDashboard } from "@/lib/auth/safe-internal-redirect"
import { prepareBusinessProfileForStartTrial } from "@/lib/start-trial/prepare-business-profile-server"
import { getServerClient, isSupabaseConfigured } from "@/lib/supabase/server"

type EmailOtpType = "signup" | "invite" | "magiclink" | "recovery" | "email_change" | "email"

function parseEmailOtpType(raw: string | null): EmailOtpType | null {
  if (
    raw === "signup" ||
    raw === "invite" ||
    raw === "magiclink" ||
    raw === "recovery" ||
    raw === "email_change" ||
    raw === "email"
  ) {
    return raw
  }
  return null
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const origin = requestUrl.origin

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/login", origin))
  }

  const requestedNext = safeInternalRedirectOrDashboard(
    requestUrl.searchParams.get("next") ?? requestUrl.searchParams.get("redirectTo") ?? "/start-trial",
  )
  const tokenHash = requestUrl.searchParams.get("token_hash")
  const type = parseEmailOtpType(requestUrl.searchParams.get("type"))
  const code = requestUrl.searchParams.get("code")

  const supabase = await getServerClient()
  if (!supabase) {
    return NextResponse.redirect(new URL("/login", origin))
  }

  if (code && !tokenHash) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      const dest = new URL(oauthErrorReturnPath(requestedNext), origin)
      // Supabase verifies the email before redirecting here with `code`.
      // Session exchange can still fail without the original browser PKCE state;
      // in that case the account is already confirmed, so ask the user to log in.
      dest.searchParams.set("confirmed", "1")
      dest.searchParams.set("next", requestedNext)
      return NextResponse.redirect(dest)
    }

    const prepare = await prepareBusinessProfileForStartTrial()
    if (prepare.ok === false && prepare.error === "missing_account_type") {
      /* OAuth / brak metadanych z formularza - profil uzupelnia sie w /settings?setup=business */
    }

    const next = await resolvePostAuthRedirect(supabase, requestedNext, {
      trialFromCookie: requestedNext === "/start-trial",
    })
    return NextResponse.redirect(new URL(next, origin))
  }

  if (!tokenHash || !type) {
    const dest = new URL(oauthErrorReturnPath(requestedNext), origin)
    dest.searchParams.set("oauth_error", "auth_link_invalid_or_expired")
    dest.searchParams.set("next", requestedNext)
    return NextResponse.redirect(dest)
  }

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  })

  if (error) {
    const dest = new URL(oauthErrorReturnPath(requestedNext), origin)
    dest.searchParams.set("oauth_error", "auth_link_invalid_or_expired")
    dest.searchParams.set("next", requestedNext)
    return NextResponse.redirect(dest)
  }

  if (type === "signup" || type === "email") {
    const prepare = await prepareBusinessProfileForStartTrial()
    if (prepare.ok === false && prepare.error === "missing_account_type") {
      /* OAuth / brak metadanych z formularza - profil uzupelnia sie w /settings?setup=business */
    }
  }

  const next = await resolvePostAuthRedirect(supabase, requestedNext, {
    trialFromCookie: requestedNext === "/start-trial",
  })
  return NextResponse.redirect(new URL(next, origin))
}
