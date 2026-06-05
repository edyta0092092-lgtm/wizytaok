import { NextResponse } from "next/server"

import { resolveAdminBusinessForUser } from "@/lib/auth/resolve-admin-business-server"
import { revokeStaffPanelAccessServer } from "@/lib/team/revoke-staff-panel-access-server"
import { getServiceRoleClient } from "@/lib/supabase/service-role"

export const dynamic = "force-dynamic"

type Body = { staffMemberId?: string }

export async function POST(req: Request) {
  const resolution = await resolveAdminBusinessForUser()
  if (!resolution.ok) {
    return NextResponse.json({ ok: false, error: resolution.error }, { status: resolution.status })
  }

  const admin = getServiceRoleClient()
  if (!admin) {
    return NextResponse.json({ ok: false, error: "supabase_unconfigured" }, { status: 500 })
  }

  let body: Body = {}
  try {
    body = (await req.json()) as Body
  } catch {
    body = {}
  }

  const staffMemberId = typeof body.staffMemberId === "string" ? body.staffMemberId.trim() : ""
  if (!staffMemberId) {
    return NextResponse.json({ ok: false, error: "staff_member_id_required" }, { status: 400 })
  }

  const result = await revokeStaffPanelAccessServer(admin, resolution.businessId, staffMemberId)
  if (!result.ok) {
    const status =
      result.error === "staff_not_found"
        ? 404
        : result.error === "cannot_remove_owner"
          ? 409
          : 500
    return NextResponse.json({ ok: false, error: result.error }, { status })
  }

  return NextResponse.json({ ok: true })
}
