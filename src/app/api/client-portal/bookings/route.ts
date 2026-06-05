import { NextResponse } from "next/server"

import { fetchClientBookingsByEmail } from "@/lib/client-portal/fetch-client-bookings-server"
import { requireClientPortalSession } from "@/lib/client-portal/require-client-session-server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  const auth = await requireClientPortalSession()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { bookings, dashboard } = await fetchClientBookingsByEmail(auth.ctx.email)
  return NextResponse.json({ ok: true, bookings, dashboard })
}
