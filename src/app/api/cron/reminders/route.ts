import { NextResponse } from "next/server"

import { processDueBookingReminders } from "@/lib/notifications/reminders-v2"

/**
 * Cron: automatic 24h booking reminders (server-side only).
 * Wire to Vercel Cron, Supabase Scheduled Function, or any scheduler every 5-15 minutes.
 *
 * curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/reminders
 *
 * Env: CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL,
 * optional RESEND_*, TWILIO_*, APP_ORIGIN / NEXT_PUBLIC_APP_URL / VERCEL_URL.
 */
function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false
  const h = req.headers.get("authorization")?.trim()
  return h === `Bearer ${secret}`
}

export async function GET(req: Request) {
  return handle(req)
}

export async function POST(req: Request) {
  return handle(req)
}

async function handle(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }
  const result = await processDueBookingReminders()
  return NextResponse.json({
    ok: result.ok,
    firstReminderProcessed: result.firstReminderProcessed,
    secondReminderProcessed: result.secondReminderProcessed,
    failed: result.failed,
    skipped: result.skipped,
    error: result.error,
  })
}
