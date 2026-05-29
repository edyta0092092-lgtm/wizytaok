import { NextResponse } from "next/server"

import { resolveSupabaseBookingRowUuidFromUiId } from "@/lib/bookings/bookings-store"
import {
  sendCustomTemplateManual,
  type CustomTemplateBusinessRow,
  type CustomTemplateRow,
} from "@/lib/notifications/custom-template-send"
import { getServerClient } from "@/lib/supabase/server"
import { getServiceRoleClient } from "@/lib/supabase/service-role"
import type { Tables } from "@/types/database"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Body = {
  bookingId?: string
  customTemplateId?: string
}

/**
 * Ręczna wysyłka własnego szablonu „wyślij teraz" do konkretnej wizyty.
 */
export async function POST(req: Request) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const rawId = typeof body.bookingId === "string" ? body.bookingId.trim() : ""
  const bookingUuid = resolveSupabaseBookingRowUuidFromUiId(rawId)
  const templateId = typeof body.customTemplateId === "string" ? body.customTemplateId.trim() : ""
  if (!bookingUuid || !templateId) {
    return NextResponse.json({ ok: false, error: "invalid_arguments" }, { status: 400 })
  }

  const supabase = await getServerClient()
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "supabase_unconfigured" }, { status: 500 })
  }
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()
  if (userErr || !user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  // RLS gwarantuje, że użytkownik widzi tylko wizyty/szablony swojej firmy.
  const { data: bookingRow, error: bookingErr } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", bookingUuid)
    .maybeSingle()
  if (bookingErr || !bookingRow) {
    return NextResponse.json({ ok: false, error: "booking_not_found" }, { status: 404 })
  }
  const booking = bookingRow as Tables<"bookings">

  const { data: templateRow, error: tplErr } = await supabase
    .from("custom_templates")
    .select("*")
    .eq("id", templateId)
    .maybeSingle()
  if (tplErr || !templateRow) {
    return NextResponse.json({ ok: false, error: "template_not_found" }, { status: 404 })
  }
  const template = templateRow as CustomTemplateRow
  if (template.business_id !== booking.business_id) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 })
  }

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("id, slug, phone, contact_phone, business_name, business_address")
    .eq("id", booking.business_id)
    .maybeSingle()
  if (!profile) {
    return NextResponse.json({ ok: false, error: "no_business" }, { status: 404 })
  }

  const admin = getServiceRoleClient()
  if (!admin) {
    return NextResponse.json({ ok: false, error: "service_role_missing" }, { status: 500 })
  }

  try {
    const outcomes = await sendCustomTemplateManual(admin, {
      template,
      booking: {
        id: booking.id,
        business_id: booking.business_id,
        client_name: booking.client_name ?? null,
        client_email: booking.client_email ?? null,
        client_phone: booking.client_phone ?? null,
        service_name: booking.service_name ?? null,
        appointment_date: booking.appointment_date,
        appointment_time: booking.appointment_time,
        staff_name: (booking as { staff_name?: string | null }).staff_name ?? null,
        confirmation_token: (booking as { confirmation_token?: string | null }).confirmation_token ?? null,
      },
      business: profile as CustomTemplateBusinessRow,
    })
    if (outcomes.length === 0) {
      return NextResponse.json({ ok: true, notice: "skipped" as const, reason: "no_channel_or_contact" })
    }
    return NextResponse.json({ ok: true, outcomes })
  } catch {
    return NextResponse.json({ ok: false, error: "send_error" }, { status: 500 })
  }
}
