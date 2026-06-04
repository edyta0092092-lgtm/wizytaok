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
  thank_you_after_visit: ["thank_you_after_visit", "thank_you", "visit_thank_you"],
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

function pickChannelRow(
  rows: Tables<"message_templates">[],
  templateType: string,
  channel: "sms" | "email",
): Tables<"message_templates"> | undefined {
  const typeNorm = normalize(templateType)
  const primary = rows.find(
    (row) => normalize(row.type) === typeNorm && normalize(row.channel) === channel,
  )
  if (primary) return primary
  return rows.find((row) => normalize(row.channel) === channel)
}

export async function getTemplateRuntime(
  client: Sb,
  businessId: string,
  templateType: string
): Promise<NotificationTemplateRuntime> {
  const aliases = TYPE_ALIASES[templateType] ?? [templateType]
  const aliasSet = new Set(aliases.map(normalize))
  // Uwaga: NIE filtrujemy po `type` w SQL. Kolumna `type` to ENUM, a lista aliasów
  // może zawierać wartości spoza enuma (np. legacy/synonimy). PostgREST rzutuje
  // literały na enum i całe zapytanie pada na nieistniejącej wartości, przez co
  // szablon nie jest znajdowany (fallback + zignorowany przełącznik on/off).
  // Pobieramy wszystkie szablony firmy i filtrujemy aliasy w JS.
  const { data, error } = await client
    .from("message_templates")
    .select("*")
    .eq("business_id", businessId)
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

  const rows = ((data ?? []) as Tables<"message_templates">[]).filter((row) =>
    aliasSet.has(normalize(row.type)),
  )
  const sms = pickChannelRow(rows, templateType, "sms")
  const email = pickChannelRow(rows, templateType, "email")
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
