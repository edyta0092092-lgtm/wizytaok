import { NextResponse } from "next/server"

import { updateSelectedCalendar } from "@/lib/integrations/google-calendar/connection-repository"
import { requireGoogleCalendarMember } from "@/lib/integrations/google-calendar/member-auth"
import { isGoogleCalendarPersistenceReady } from "@/lib/integrations/google-calendar/persistence-ready"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Body = { calendarId?: string }

export async function POST(req: Request) {
  const auth = await requireGoogleCalendarMember()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  if (!(await isGoogleCalendarPersistenceReady())) {
    return NextResponse.json({ ok: false, error: "persistence_not_ready" }, { status: 503 })
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const calendarId = typeof body.calendarId === "string" ? body.calendarId.trim() : ""
  if (!calendarId) {
    return NextResponse.json({ ok: false, error: "calendar_id_required" }, { status: 400 })
  }

  const ok = await updateSelectedCalendar(auth.ctx.businessId, auth.ctx.userId, calendarId)
  return NextResponse.json({ ok })
}
