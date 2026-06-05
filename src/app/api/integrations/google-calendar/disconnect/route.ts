import { NextResponse } from "next/server"

import { disconnectConnection } from "@/lib/integrations/google-calendar/connection-repository"
import { requireGoogleCalendarMember } from "@/lib/integrations/google-calendar/member-auth"
import { isGoogleCalendarPersistenceReady } from "@/lib/integrations/google-calendar/persistence-ready"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST() {
  const auth = await requireGoogleCalendarMember()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  if (!(await isGoogleCalendarPersistenceReady())) {
    return NextResponse.json({ ok: false, error: "persistence_not_ready" }, { status: 503 })
  }

  const ok = await disconnectConnection(auth.ctx.businessId, auth.ctx.userId)
  return NextResponse.json({ ok })
}
