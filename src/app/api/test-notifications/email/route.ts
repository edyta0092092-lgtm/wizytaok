import { NextResponse } from "next/server"

import { resolveAdminBusinessForUser } from "@/lib/auth/resolve-admin-business-server"
import { readTestIntegrationFlags } from "@/lib/config/test-integration-flags"
import { sendReminderEmail } from "@/lib/notifications/email"
import { getServiceRoleClient } from "@/lib/supabase/service-role"
import type { TablesInsert } from "@/types/database"

const EMAIL_SUBJECT = "WizytaOK — wiadomość testowa"
const EMAIL_BODY =
  "To jest testowa wiadomość z panelu WizytaOK. Jeśli ją widzisz, integracja e-mail działa."

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

type Body = {
  to?: string
}

export async function POST(req: Request) {
  const flags = readTestIntegrationFlags()
  if (!flags.enableTestNotifications) {
    return NextResponse.json({ ok: false, error: "disabled" }, { status: 404 })
  }

  let body: Body = {}
  try {
    body = (await req.json()) as Body
  } catch {
    body = {}
  }

  const resolution = await resolveAdminBusinessForUser()
  if (!resolution.ok) {
    return NextResponse.json({ ok: false, error: resolution.error }, { status: resolution.status })
  }

  const rawTo = typeof body.to === "string" ? body.to.trim() : ""
  const to = rawTo || (resolution.userEmail?.trim() ?? "")
  if (!to || !isValidEmail(to)) {
    return NextResponse.json({ ok: false, error: "invalid_or_missing_email" }, { status: 400 })
  }

  const result = await sendReminderEmail({
    to,
    subject: EMAIL_SUBJECT,
    textBody: EMAIL_BODY,
    htmlBody: `<p>${EMAIL_BODY}</p>`,
  })

  const admin = getServiceRoleClient()
  if (!admin) {
    return NextResponse.json({ ok: false, error: "service_role_missing" }, { status: 500 })
  }

  const sent = result.ok === true
  const failDetail =
    result.ok === true
      ? null
      : result.code === "simulated_dev" || result.code === "not_configured"
        ? `${result.code}: ${result.error ?? ""}`.trim()
        : result.error ?? result.code

  const row: TablesInsert<"notification_logs"> = {
    business_id: resolution.businessId,
    booking_id: null,
    channel: "email",
    type: "integration_test",
    recipient: to,
    status: sent ? "sent" : "failed",
    subject: EMAIL_SUBJECT,
    body: EMAIL_BODY,
    provider: sent ? result.provider : null,
    provider_message_id: sent && "messageId" in result ? result.messageId ?? null : null,
    error_message: sent ? null : failDetail,
    sent_at: sent ? new Date().toISOString() : null,
  }

  const { error: insErr } = await admin.from("notification_logs").insert(row)
  if (insErr) {
    return NextResponse.json(
      { ok: false, error: "log_insert_failed", detail: insErr.message },
      { status: 500 }
    )
  }

  if (!sent) {
    return NextResponse.json(
      { ok: false, error: "send_failed", code: result.ok === false ? result.code : "failed", message: failDetail },
      { status: 422 }
    )
  }

  return NextResponse.json({ ok: true })
}
