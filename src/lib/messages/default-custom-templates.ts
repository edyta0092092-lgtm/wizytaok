import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, TablesInsert } from "@/types/database"

/** Stała nazwa domyślnego szablonu „po wizycie” — używana do deduplikacji. */
export const THANK_YOU_AFTER_VISIT_TEMPLATE_NAME = "Podziękowanie po wizycie"

const SMS_BODY =
  "Cześć {{imie}}, dziękujemy za skorzystanie z naszych usług. Jeśli potrzebujesz, zapraszamy ponownie: {{link_rezerwacji}}. Pozdrawiamy, {{nazwa_firmy}}"

const EMAIL_SUBJECT = "{{nazwa_firmy}}: Dziękujemy za wizytę"

const EMAIL_BODY = `Cześć {{imie}},

dziękujemy za skorzystanie z naszych usług. Jeśli potrzebujesz, zapraszamy ponownie:
{{link_rezerwacji}}

Pozdrawiamy,
{{nazwa_firmy}}`

export function buildThankYouAfterVisitTemplateInsert(
  businessId: string,
): TablesInsert<"custom_templates"> {
  return {
    business_id: businessId,
    name: THANK_YOU_AFTER_VISIT_TEMPLATE_NAME,
    sms_enabled: true,
    sms_content: SMS_BODY,
    email_enabled: true,
    email_subject: EMAIL_SUBJECT,
    email_content: EMAIL_BODY,
    trigger_type: "event",
    offset_minutes: null,
    event_key: "completed",
    status: "active",
  }
}

type AdminClient = SupabaseClient<Database>

function isThankYouTemplateName(name: string | null | undefined): boolean {
  return String(name ?? "").trim().toLowerCase() === THANK_YOU_AFTER_VISIT_TEMPLATE_NAME.toLowerCase()
}

/**
 * Stary domyślny szablon (20 min po wizycie) → wysyłka przy zmianie statusu na „zrealizowana”.
 */
async function migrateLegacyThankYouScheduleTemplate(
  admin: AdminClient,
  businessId: string,
): Promise<void> {
  const { data: legacyRows } = await admin
    .from("custom_templates")
    .select("id,trigger_type,offset_minutes,name")
    .eq("business_id", businessId)
    .eq("trigger_type", "schedule_after")

  for (const row of legacyRows ?? []) {
    if (!isThankYouTemplateName(row.name)) continue
    if (row.offset_minutes !== 20 && row.offset_minutes != null) continue
    await admin
      .from("custom_templates")
      .update({
        trigger_type: "event",
        offset_minutes: null,
        event_key: "completed",
      })
      .eq("id", row.id)
  }
}

/**
 * Wstawia domyślny szablon „Podziękowanie po wizycie” (przy statusie zrealizowana, SMS + e-mail),
 * jeśli firma go jeszcze nie ma.
 */
export async function ensureThankYouAfterVisitTemplate(
  admin: AdminClient,
  businessId: string,
): Promise<{ inserted: boolean }> {
  await migrateLegacyThankYouScheduleTemplate(admin, businessId)

  const { data: existing } = await admin
    .from("custom_templates")
    .select("id")
    .eq("business_id", businessId)
    .eq("trigger_type", "event")
    .eq("event_key", "completed")
    .eq("name", THANK_YOU_AFTER_VISIT_TEMPLATE_NAME)
    .limit(1)
    .maybeSingle()

  if (existing?.id) return { inserted: false }

  const { error } = await admin
    .from("custom_templates")
    .insert(buildThankYouAfterVisitTemplateInsert(businessId))

  if (error) {
    if (error.code === "23505") return { inserted: false }
    throw new Error(error.message)
  }
  return { inserted: true }
}

export async function ensureDefaultCustomTemplatesForBusiness(
  admin: AdminClient,
  businessId: string,
): Promise<{ thankYouInserted: boolean }> {
  const thankYou = await ensureThankYouAfterVisitTemplate(admin, businessId)
  return { thankYouInserted: thankYou.inserted }
}
