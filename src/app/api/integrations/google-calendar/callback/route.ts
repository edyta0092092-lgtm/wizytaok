import { NextResponse } from "next/server"

import { upsertConnection } from "@/lib/integrations/google-calendar/connection-repository"
import {
  exchangeGoogleCalendarCode,
  fetchGoogleUserEmail,
} from "@/lib/integrations/google-calendar/google-oauth-client"
import { decodeGoogleCalendarOAuthState } from "@/lib/integrations/google-calendar/oauth-state"
import { invalidateGoogleCalendarPersistenceCache } from "@/lib/integrations/google-calendar/persistence-ready"
import { encryptRefreshToken } from "@/lib/integrations/google-calendar/token-crypto"
import { getServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const origin = url.origin
  const dest = new URL("/settings/integrations", origin)

  const oauthError = url.searchParams.get("error")
  if (oauthError) {
    dest.searchParams.set("google_calendar", "cancelled")
    return NextResponse.redirect(dest)
  }

  const code = url.searchParams.get("code")
  const stateRaw = url.searchParams.get("state")
  if (!code || !stateRaw) {
    dest.searchParams.set("google_calendar", "error")
    return NextResponse.redirect(dest)
  }

  const state = decodeGoogleCalendarOAuthState(stateRaw)
  if (!state) {
    dest.searchParams.set("google_calendar", "error")
    return NextResponse.redirect(dest)
  }

  const supabase = await getServerClient()
  if (!supabase) {
    dest.searchParams.set("google_calendar", "error")
    return NextResponse.redirect(dest)
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.id !== state.userId) {
    dest.searchParams.set("google_calendar", "error")
    return NextResponse.redirect(dest)
  }

  const tokens = await exchangeGoogleCalendarCode(origin, code)
  if (!tokens?.refresh_token) {
    dest.searchParams.set("google_calendar", "missing_refresh")
    return NextResponse.redirect(dest)
  }

  const encrypted = encryptRefreshToken(tokens.refresh_token)
  if (!encrypted) {
    dest.searchParams.set("google_calendar", "encryption_error")
    return NextResponse.redirect(dest)
  }

  const email = await fetchGoogleUserEmail(tokens.access_token)

  const { data: member } = await supabase
    .from("business_members")
    .select("id, staff_member_id")
    .eq("user_id", user.id)
    .eq("business_id", state.businessId)
    .eq("is_active", true)
    .maybeSingle()

  if (!member?.id) {
    dest.searchParams.set("google_calendar", "error")
    return NextResponse.redirect(dest)
  }

  const saved = await upsertConnection({
    businessId: state.businessId,
    userId: user.id,
    businessMemberId: member.id,
    staffMemberId: member.staff_member_id,
    googleAccountEmail: email,
    encrypted,
  })

  invalidateGoogleCalendarPersistenceCache()

  dest.searchParams.set("google_calendar", saved ? "connected" : "error")
  return NextResponse.redirect(dest)
}
