import { NextResponse } from "next/server"

import { resolveAdminBusinessForUser } from "@/lib/auth/resolve-admin-business-server"
import { readTestIntegrationFlags } from "@/lib/config/test-integration-flags"
import { sendReminderSms } from "@/lib/notifications/sms"
import { getServiceRoleClient } from "@/lib/supabase/service-role"
import type { TablesInsert } from "@/types/database"

const SMS_BODY = "WizytaOK: wiadomość testowa SMS z panelu administracyjnego."

type Body = {
  to?: string
}

export async function POST(req: Request) {
  const flags = readTestIntegrationFlags()
  if (!flags.enableTestNotifications) {
    return NextResponse.json({ ok: false, error: "disabled" }, { status: 404 })
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const resolution = await resolveAdminBusinessForUser()
  if (!resolution.ok) {
    return NextResponse.json({ ok: false, error: resolution.error }, { status: resolution.status })
  }

  const to = typeof body.to === "string" ? body.to.trim() : ""
  if (!to || to.length < 8) {
    return NextResponse.json({ ok: false, error: "invalid_or_missing_phone" }, { status: 400 })
  }

  const result = await sendReminderSms({ to, body: SMS_BODY })

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
    channel: "sms",
    type: "integration_test",
    recipient: to,
    status: sent ? "sent" : "failed",
    subject: null,
    body: SMS_BODY,
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
