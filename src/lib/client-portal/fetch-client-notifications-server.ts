import type { ClientPortalNotification } from "@/lib/client-portal/types"
import { getServiceRoleClient } from "@/lib/supabase/service-role"

function mapLogRow(row: Record<string, unknown>): ClientPortalNotification {
  const body = typeof row.body === "string" ? row.body : null
  return {
    id: String(row.id ?? ""),
    channel: String(row.channel ?? ""),
    type: String(row.type ?? ""),
    status: String(row.status ?? ""),
    subject: typeof row.subject === "string" ? row.subject : null,
    bodyPreview: body ? body.slice(0, 160) : null,
    sentAt: typeof row.sent_at === "string" ? row.sent_at : null,
    createdAt: String(row.created_at ?? ""),
    bookingId: typeof row.booking_id === "string" ? row.booking_id : null,
  }
}

export async function fetchClientNotificationsByEmail(email: string): Promise<{
  all: ClientPortalNotification[]
  lastSms: ClientPortalNotification | null
  lastEmail: ClientPortalNotification | null
}> {
  const admin = getServiceRoleClient()
  if (!admin) {
    return { all: [], lastSms: null, lastEmail: null }
  }

  const normalized = email.trim().toLowerCase()

  const { data: byRecipient, error: rErr } = await admin
    .from("notification_logs")
    .select(
      "id,channel,type,status,subject,body,sent_at,created_at,booking_id,recipient",
    )
    .ilike("recipient", normalized)
    .order("created_at", { ascending: false })
    .limit(50)

  let rows = (byRecipient ?? []) as Record<string, unknown>[]

  if (rErr || rows.length === 0) {
    const { data: bookingIds } = await admin
      .from("bookings")
      .select("id")
      .ilike("client_email", normalized)
      .limit(100)

    const ids = (bookingIds ?? []).map((b) => b.id).filter(Boolean)
    if (ids.length > 0) {
      const { data: byBooking } = await admin
        .from("notification_logs")
        .select(
          "id,channel,type,status,subject,body,sent_at,created_at,booking_id,recipient",
        )
        .in("booking_id", ids)
        .order("created_at", { ascending: false })
        .limit(50)
      rows = (byBooking ?? []) as Record<string, unknown>[]
    }
  }

  const all = rows.map(mapLogRow)
  const lastSms = all.find((n) => n.channel === "sms") ?? null
  const lastEmail = all.find((n) => n.channel === "email") ?? null

  return { all, lastSms, lastEmail }
}
