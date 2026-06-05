import { NextResponse } from "next/server"

import { resolveAdminBusinessForUser } from "@/lib/auth/resolve-admin-business-server"
import type { PanelRole } from "@/lib/auth/permissions"
import { syncStaffPanelRoleServer } from "@/lib/team/sync-staff-panel-role-server"

export const dynamic = "force-dynamic"

type Body = {
  staffMemberId?: string
  panelMemberRole?: string
  invitationEmail?: string
}

function normalizePanelRole(raw: string | undefined): PanelRole {
  return raw === "admin" ? "admin" : "staff"
}

export async function POST(req: Request) {
  const resolution = await resolveAdminBusinessForUser()
  if (!resolution.ok) {
    return NextResponse.json({ ok: false, error: resolution.error }, { status: resolution.status })
  }

  let body: Body = {}
  try {
    body = (await req.json()) as Body
  } catch {
    body = {}
  }

  const staffMemberId = typeof body.staffMemberId === "string" ? body.staffMemberId.trim() : ""
  const invitationEmail =
    typeof body.invitationEmail === "string" ? body.invitationEmail.trim() : undefined

  if (!staffMemberId) {
    return NextResponse.json({ ok: false, error: "staff_member_id_required" }, { status: 400 })
  }

  const result = await syncStaffPanelRoleServer(
    resolution.businessId,
    staffMemberId,
    normalizePanelRole(body.panelMemberRole),
    invitationEmail,
  )

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    hasLinkedPanel: result.hasLinkedPanel,
    memberRoleUpdated: result.memberRoleUpdated,
  })
}
