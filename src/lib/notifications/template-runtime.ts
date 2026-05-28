import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, Tables } from "@/types/database"

type Sb = SupabaseClient<Database>

export type NotificationTemplateRuntime = {
  smsExists: boolean
  emailExists: boolean
  smsEnabled: boolean
  emailEnabled: boolean
  smsBody: string | null
  emailSubject: string | null
  emailBody: string | null
  timingMinutesBefore: number | null
}

const TYPE_ALIASES: Record<string, string[]> = {
  reminder_24h: ["reminder_24h", "reminder", "first_reminder_24h", "appointment_reminder_24h"],
  reminder_before_visit: ["reminder_before_visit", "second_reminder", "appointment_reminder_short"],
  booking_confirmation: ["booking_confirmation", "confirmation", "booking_confirmed", "booking_created"],
  booking_cancelled_by_company: [
    "booking_cancelled_by_company",
    "company_cancelled_booking",
    "booking_cancelled_by_client",
    "client_cancelled_booking",
  ],
  booking_cancelled_by_client: ["booking_cancelled_by_client", "client_cancelled_booking"],
  no_show_follow_up: ["no_show_follow_up", "followup_noshow", "follow_up_no_show"],
}

function normalize(raw: string | null | undefined): string {
  return String(raw ?? "").trim().toLowerCase()
}

function isActive(row: Pick<Tables<"message_templates">, "status">): boolean {
  return row.status === "active"
}

function bestTitle(row: Pick<Tables<"message_templates">, "title" | "content">): string | null {
  const t = row.title?.trim()
  if (t) return t
  return null
}

export async function getTemplateRuntime(
  client: Sb,
  businessId: string,
  templateType: string
): Promise<NotificationTemplateRuntime> {
  const aliases = TYPE_ALIASES[templateType] ?? [templateType]
  const { data, error } = await client
    .from("message_templates")
    .select("*")
    .eq("business_id", businessId)
    .in("type", aliases as never)
    .order("updated_at", { ascending: false })

  if (error) {
    return {
      smsEnabled: false,
      emailEnabled: false,
      smsExists: false,
      emailExists: false,
      smsBody: null,
      emailSubject: null,
      emailBody: null,
      timingMinutesBefore: null,
    }
  }

  const rows = (data ?? []) as Tables<"message_templates">[]
  const sms = rows.find((row) => normalize(row.channel) === "sms")
  const email = rows.find((row) => normalize(row.channel) === "email")
  const runtime = rows.find((row) => typeof (row as { timing_minutes_before?: unknown }).timing_minutes_before === "number")

  const timingCandidate = (runtime as { timing_minutes_before?: unknown } | undefined)?.timing_minutes_before
  const timingMinutesBefore =
    typeof timingCandidate === "number" && Number.isFinite(timingCandidate) ? Math.max(0, Math.floor(timingCandidate)) : null

  return {
    smsExists: Boolean(sms),
    emailExists: Boolean(email),
    smsEnabled: Boolean(sms && isActive(sms)),
    emailEnabled: Boolean(email && isActive(email)),
    smsBody: sms?.content?.trim() || null,
    emailSubject: email ? bestTitle(email) : null,
    emailBody: email?.content?.trim() || null,
    timingMinutesBefore,
  }
}

export function applyTemplateVariables(body: string, vars: Record<string, string>): string {
  let out = body
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(`{{${key}}}`).join(value)
  }
  return out
}
