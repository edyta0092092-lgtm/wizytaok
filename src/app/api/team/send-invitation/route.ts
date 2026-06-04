import { NextResponse } from "next/server"

import { resolveAdminBusinessForUser } from "@/lib/auth/resolve-admin-business-server"
import type { Language } from "@/lib/i18n/dictionaries"
import { deliverStaffInvitation } from "@/lib/team/deliver-staff-invitation"
import { getServiceRoleClient } from "@/lib/supabase/service-role"
import type { PanelRole } from "@/lib/auth/permissions"

export const dynamic = "force-dynamic"

type Body = {
  token?: string
  language?: string
}

function normalizeLanguage(raw: string | undefined): Language {
  return raw === "en" ? "en" : "pl"
}

function normalizePanelRole(raw: string | null | undefined): PanelRole {
  const n = String(raw ?? "").trim().toLowerCase()
  return n === "admin" ? "admin" : "staff"
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

  const token = typeof body.token === "string" ? body.token.trim() : ""
  if (!token) {
    return NextResponse.json({ ok: false, error: "token_required" }, { status: 400 })
  }

  const admin = getServiceRoleClient()
  if (!admin) {
    return NextResponse.json({ ok: false, error: "supabase_unconfigured" }, { status: 500 })
  }

  const { data: invitation, error: invErr } = await admin
    .from("business_invitations")
    .select("id, email, role, status, business_id, staff_member_id")
    .eq("business_id", resolution.businessId)
    .eq("token", token)
    .maybeSingle()

  if (invErr) {
    return NextResponse.json({ ok: false, error: invErr.message }, { status: 500 })
  }
  if (!invitation) {
    return NextResponse.json({ ok: false, error: "invitation_not_found" }, { status: 404 })
  }
  if (invitation.status !== "pending") {
    return NextResponse.json({ ok: false, error: "invitation_not_pending" }, { status: 409 })
  }

  const to = String(invitation.email ?? "").trim().toLowerCase()
  if (!to) {
    return NextResponse.json({ ok: false, error: "invitation_email_missing" }, { status: 400 })
  }

  const { data: business } = await admin
    .from("business_profiles")
    .select("business_name")
    .eq("id", resolution.businessId)
    .maybeSingle()

  let inviteeName: string | undefined
  if (invitation.staff_member_id) {
    const { data: staff } = await admin
      .from("staff_members")
      .select("name")
      .eq("id", invitation.staff_member_id)
      .maybeSingle()
    inviteeName = staff?.name?.trim() || undefined
  }

  const businessName = business?.business_name?.trim() || "WizytaOK"
  const language = normalizeLanguage(body.language)

  const sendResult = await deliverStaffInvitation({
    token,
    invitationEmail: to,
    businessName,
    role: normalizePanelRole(invitation.role),
    inviteeName,
    language,
  })

  if (!sendResult.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: sendResult.code,
        detail: sendResult.error ?? null,
      },
      { status: sendResult.code === "not_configured" || sendResult.code === "simulated_dev" ? 503 : 502 },
    )
  }

  return NextResponse.json({
    ok: true,
    invitationId: invitation.id,
    messageId: sendResult.messageId ?? null,
  })
}
