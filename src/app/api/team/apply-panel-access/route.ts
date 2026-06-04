import { NextResponse } from "next/server"

import { resolveAdminBusinessForUser } from "@/lib/auth/resolve-admin-business-server"
import type { PanelRole } from "@/lib/auth/permissions"
import type { Language } from "@/lib/i18n/dictionaries"
import { getPublicAppOrigin } from "@/lib/notifications/public-app-origin"
import { applyStaffPanelAccess } from "@/lib/team/apply-staff-panel-access"
import { sendBusinessInvitationEmail } from "@/lib/team/send-business-invitation-email"
import { getServiceRoleClient } from "@/lib/supabase/service-role"

export const dynamic = "force-dynamic"

type Body = {
  staffMemberId?: string
  panelMemberRole?: string
  invitationEmail?: string
  language?: string
  sendEmail?: boolean
}

function normalizePanelRole(raw: string | undefined): PanelRole {
  return raw === "admin" ? "admin" : "staff"
}

function normalizeLanguage(raw: string | undefined): Language {
  return raw === "en" ? "en" : "pl"
}

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
  const invitationEmail =
    typeof body.invitationEmail === "string" ? body.invitationEmail.trim() : ""
  if (!staffMemberId || !invitationEmail) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 })
  }

  const { data: staffRow } = await admin
    .from("staff_members")
    .select("id, name, business_id")
    .eq("id", staffMemberId)
    .eq("business_id", resolution.businessId)
    .maybeSingle()

  if (!staffRow?.id) {
    return NextResponse.json({ ok: false, error: "staff_not_found" }, { status: 404 })
  }

  const panelOut = await applyStaffPanelAccess(
    admin,
    resolution.businessId,
    staffMemberId,
    {
      panelMemberRole: normalizePanelRole(body.panelMemberRole),
      invitationEmail,
    },
    resolution.userId,
  )

  if (!panelOut.ok) {
    return NextResponse.json(
      {
        ok: false,
        messageKey: panelOut.messageKey,
        detail: panelOut.detail ?? null,
      },
      { status: 400 },
    )
  }

  if ("alreadyHasPanelAccess" in panelOut && panelOut.alreadyHasPanelAccess) {
    return NextResponse.json({
      ok: true,
      invitationToken: panelOut.invitationToken ?? null,
      alreadyHasPanelAccess: true,
      email: { sent: false },
    })
  }

  if (!("invitationToken" in panelOut) || !panelOut.invitationToken) {
    return NextResponse.json(
      {
        ok: false,
        messageKey: "invitations.invitationCreateError",
        detail: "invitation_token_missing",
      },
      { status: 500 },
    )
  }

  const sendEmail = body.sendEmail !== false
  const language = normalizeLanguage(body.language)
  let emailResult: { sent: boolean; code?: string } = { sent: false }

  if (sendEmail && panelOut.invitationToken) {
    const { data: business } = await admin
      .from("business_profiles")
      .select("business_name")
      .eq("id", resolution.businessId)
      .maybeSingle()

    const inviteUrl = `${getPublicAppOrigin()}/accept-invite/${panelOut.invitationToken}`
    const sendOut = await sendBusinessInvitationEmail({
      to: invitationEmail.trim().toLowerCase(),
      businessName: business?.business_name?.trim() || "WizytaOK",
      inviteUrl,
      role: normalizePanelRole(body.panelMemberRole),
      inviteeName: staffRow.name?.trim() || undefined,
      language,
    })
    if (sendOut.ok) {
      emailResult = { sent: true }
    } else {
      emailResult = { sent: false, code: sendOut.code }
    }
  }

  return NextResponse.json({
    ok: true,
    invitationToken: panelOut.invitationToken,
    alreadyHasPanelAccess: false,
    email: emailResult,
  })
}
