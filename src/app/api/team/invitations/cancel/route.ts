import { NextResponse } from "next/server"

import { resolveAdminBusinessForUser } from "@/lib/auth/resolve-admin-business-server"
import { getServiceRoleClient } from "@/lib/supabase/service-role"

export const dynamic = "force-dynamic"

type Body = { invitationId?: string }

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

  const invitationId = typeof body.invitationId === "string" ? body.invitationId.trim() : ""
  if (!invitationId) {
    return NextResponse.json({ ok: false, error: "invitation_id_required" }, { status: 400 })
  }

  const { data, error } = await admin
    .from("business_invitations")
    .update({ status: "cancelled" })
    .eq("id", invitationId)
    .eq("business_id", resolution.businessId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle()

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
  if (!data?.id) {
    return NextResponse.json({ ok: false, error: "invitation_not_found_or_not_pending" }, { status: 404 })
  }

  return NextResponse.json({ ok: true, id: data.id })
}
