import { NextResponse } from "next/server"

import {
  getBookingCreatedNotifyStatus,
  sendBookingCreatedNotifications,
  type BookingCreatedChannelDetail,
} from "@/lib/notifications/booking-created-server"

type Body = {
  token?: string
  language?: "pl" | "en"
}

function flattenChannel(detail: BookingCreatedChannelDetail) {
  return {
    status: detail.status,
    error_message: detail.error_message ?? null,
    code: detail.code ?? null,
    provider: detail.provider ?? null,
  }
}

export async function POST(req: Request) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const token = typeof body.token === "string" ? body.token.trim() : ""
  if (!token) {
    return NextResponse.json({ ok: false, error: "token_required" }, { status: 400 })
  }

  const language = body.language === "en" ? "en" : "pl"
  const result = await sendBookingCreatedNotifications(token, language)
  const emailFlat = flattenChannel(result.email)
  const smsFlat = flattenChannel(result.sms)

  return NextResponse.json({
    ok: result.ok,
    email: emailFlat.status,
    sms: smsFlat.status,
    email_error_message: emailFlat.error_message,
    sms_error_message: smsFlat.error_message,
    email_code: emailFlat.code,
    sms_code: smsFlat.code,
    sms_provider: smsFlat.provider,
    email_detail: result.email,
    sms_detail: result.sms,
  })
}

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token")?.trim() ?? ""
  if (!token) {
    return NextResponse.json({ ok: false, error: "token_required" }, { status: 400 })
  }

  const { data: bookingRaw } = await (async () => {
    const { getServiceRoleClient } = await import("@/lib/supabase/service-role")
    const admin = getServiceRoleClient()
    if (!admin) return { data: null }
    return admin.rpc("get_booking_by_confirmation_token", { p_token: token })
  })()

  if (!bookingRaw || typeof bookingRaw !== "object") {
    return NextResponse.json({ ok: false, error: "booking_not_found" }, { status: 404 })
  }

  const bookingId = String((bookingRaw as Record<string, unknown>).id ?? "").trim()
  if (!bookingId) {
    return NextResponse.json({ ok: false, error: "booking_not_found" }, { status: 404 })
  }

  const result = await getBookingCreatedNotifyStatus(bookingId)
  const emailFlat = flattenChannel(result.email)
  const smsFlat = flattenChannel(result.sms)

  return NextResponse.json({
    ok: result.ok,
    email: emailFlat.status,
    sms: smsFlat.status,
    email_error_message: emailFlat.error_message,
    sms_error_message: smsFlat.error_message,
    email_detail: result.email,
    sms_detail: result.sms,
  })
}
