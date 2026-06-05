import { NextResponse } from "next/server"

import { getGoogleCalendarAccessToken } from "@/lib/integrations/google-calendar/access-token"
import { listGoogleCalendars } from "@/lib/integrations/google-calendar/google-calendar-api"
import { requireGoogleCalendarMember } from "@/lib/integrations/google-calendar/member-auth"
import { isGoogleCalendarPersistenceReady } from "@/lib/integrations/google-calendar/persistence-ready"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  const auth = await requireGoogleCalendarMember()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  if (!(await isGoogleCalendarPersistenceReady())) {
    return NextResponse.json({ ok: false, error: "persistence_not_ready" }, { status: 503 })
  }

  const access = await getGoogleCalendarAccessToken(auth.ctx.businessId, auth.ctx.userId)
  if (!access) {
    return NextResponse.json({ ok: false, error: "not_connected" }, { status: 400 })
  }

  const calendars = await listGoogleCalendars(access.accessToken)
  return NextResponse.json({ ok: true, calendars })
}
