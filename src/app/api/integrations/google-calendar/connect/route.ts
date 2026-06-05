import { NextResponse } from "next/server"

import { isGoogleCalendarOAuthConfigured } from "@/lib/integrations/google-calendar/config"
import { buildGoogleCalendarAuthorizeUrl } from "@/lib/integrations/google-calendar/google-oauth-client"
import { requireGoogleCalendarMember } from "@/lib/integrations/google-calendar/member-auth"
import { encodeGoogleCalendarOAuthState } from "@/lib/integrations/google-calendar/oauth-state"
import { isGoogleCalendarPersistenceReady } from "@/lib/integrations/google-calendar/persistence-ready"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  const auth = await requireGoogleCalendarMember()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  if (!isGoogleCalendarOAuthConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 })
  }

  if (!(await isGoogleCalendarPersistenceReady())) {
    return NextResponse.json({ ok: false, error: "persistence_not_ready" }, { status: 503 })
  }

  const state = encodeGoogleCalendarOAuthState({
    userId: auth.ctx.userId,
    businessId: auth.ctx.businessId,
    ts: Date.now(),
  })
  if (!state) {
    return NextResponse.json({ ok: false, error: "state_secret_missing" }, { status: 503 })
  }

  const origin = new URL(request.url).origin
  const url = buildGoogleCalendarAuthorizeUrl(origin, state)
  return NextResponse.redirect(url)
}
