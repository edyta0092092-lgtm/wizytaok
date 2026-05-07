import { NextResponse } from "next/server"

import { confirmBookingAndNotify } from "@/lib/notifications/booking-confirmed-server"

type ConfirmAttendanceBody = {
  token?: string
  language?: "pl" | "en"
}

export async function POST(req: Request) {
  let body: ConfirmAttendanceBody
  try {
    body = (await req.json()) as ConfirmAttendanceBody
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const token = typeof body.token === "string" ? body.token.trim() : ""
  if (!token) {
    return NextResponse.json({ ok: false, error: "token_required" }, { status: 400 })
  }
  const language = body.language === "en" ? "en" : "pl"
  const res = await confirmBookingAndNotify(token, language)
  const code = res.ok ? 200 : 400
  return NextResponse.json(res, { status: code })
}
