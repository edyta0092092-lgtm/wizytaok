"use server"

import { revalidatePath } from "next/cache"

import { isValidPublicSlugFormat, normalizePublicSlug } from "@/lib/business/slug"
import { isPolishNip10Valid } from "@/lib/validation/polish-nip"
import { getServerAuthUser } from "@/lib/supabase/auth"
import {
  getBusinessProfileByOwnerId,
  insertBusinessProfile,
  isBusinessSlugAvailable,
  updateBusinessProfileByOwnerId,
} from "@/lib/supabase/repositories/business-profile.repository"
import { getServerClient } from "@/lib/supabase/server"
import { getServiceRoleClient } from "@/lib/supabase/service-role"

export type SaveBusinessProfileInput = {
  businessName: string
  slug: string
  email: string
  phone: string
  /** Znormalizowany NIP lub null, gdy pusty. */
  taxId: string | null
  defaultReminderHours: number
  secondReminderMinutes: number
  reminderChannel: "sms" | "email" | "both"
}

export type SaveBusinessProfileResult =
  | { ok: true }
  | {
      ok: false
      code:
        | "unauthorized"
        | "slug_invalid"
        | "slug_taken"
        | "tax_id_invalid"
        | "tax_id_taken"
        | "phone_taken"
        | "email_taken"
        | "unknown"
      details?: string
    }

/**
 * Wyszukuje, czy jakaś inna firma (nie należąca do `ownerId`) używa już tych samych
 * danych identyfikacyjnych. Zwraca pierwszy znaleziony konflikt, lub null.
 * Używa service role, bo RLS by ograniczyło widok do własnego profilu.
 */
async function findIdentityConflict(
  ownerId: string,
  taxIdNormalized: string | null,
  contactPhoneNormalized: string | null,
  email: string | null
): Promise<"tax_id_taken" | "phone_taken" | "email_taken" | null> {
  const admin = getServiceRoleClient()
  if (!admin) return null

  if (taxIdNormalized && taxIdNormalized.length > 0) {
    const { data, error } = await admin
      .from("business_profiles")
      .select("owner_id")
      .eq("company_tax_id_normalized", taxIdNormalized)
      .neq("owner_id", ownerId)
      .limit(1)
    if (!error && data && data.length > 0) return "tax_id_taken"
  }

  if (contactPhoneNormalized && contactPhoneNormalized.length > 0) {
    const { data, error } = await admin
      .from("business_profiles")
      .select("owner_id")
      .eq("contact_phone_normalized", contactPhoneNormalized)
      .neq("owner_id", ownerId)
      .limit(1)
    if (!error && data && data.length > 0) return "phone_taken"
  }

  if (email && email.length > 0) {
    const { data, error } = await admin
      .from("business_profiles")
      .select("owner_id")
      .ilike("email", email)
      .neq("owner_id", ownerId)
      .limit(1)
    if (!error && data && data.length > 0) return "email_taken"
  }

  return null
}

function getMissingBusinessProfilesColumnFromError(message: string | undefined): string | null {
  const normalized = String(message ?? "")
  const match = normalized.match(/'([^']+)' column of 'business_profiles'/i)
  if (!match?.[1]) return null
  return match[1]
}

async function tryUpdateWithSchemaFallback(
  client: NonNullable<Awaited<ReturnType<typeof getServerClient>>>,
  ownerId: string,
  initialPatch: Record<string, unknown>
) {
  let patch: Record<string, unknown> = { ...initialPatch }
  let lastError: { message?: string; code?: string } | null = null

  for (let i = 0; i < 5; i += 1) {
    const { error } = await updateBusinessProfileByOwnerId(client, ownerId, patch as never)
    if (!error) return { error: null as null }
    lastError = error
    const missingColumn = getMissingBusinessProfilesColumnFromError(error.message)
    if (!missingColumn || !(missingColumn in patch)) return { error }
    patch = Object.fromEntries(
      Object.entries(patch).filter(([k]) => k !== missingColumn)
    ) as Record<string, unknown>
  }

  return { error: lastError }
}

async function tryInsertWithSchemaFallback(
  client: NonNullable<Awaited<ReturnType<typeof getServerClient>>>,
  initialPayload: Record<string, unknown>
) {
  let payload: Record<string, unknown> = { ...initialPayload }
  let lastError: { message?: string; code?: string } | null = null

  for (let i = 0; i < 5; i += 1) {
    const { error } = await insertBusinessProfile(client, payload as never)
    if (!error) return { error: null as null }
    lastError = error
    const missingColumn = getMissingBusinessProfilesColumnFromError(error.message)
    if (!missingColumn || !(missingColumn in payload)) return { error }
    payload = Object.fromEntries(
      Object.entries(payload).filter(([k]) => k !== missingColumn)
    ) as Record<string, unknown>
  }

  return { error: lastError }
}

export async function saveBusinessProfileAction(
  input: SaveBusinessProfileInput
): Promise<SaveBusinessProfileResult> {
  const user = await getServerAuthUser()
  if (!user) return { ok: false, code: "unauthorized" }

  const slug = normalizePublicSlug(input.slug)
  if (!isValidPublicSlugFormat(slug)) return { ok: false, code: "slug_invalid" }

  const client = await getServerClient()
  if (!client) return { ok: false, code: "unknown" }

  const { data: existing } = await getBusinessProfileByOwnerId(client, user.id)

  if (slug !== existing?.slug) {
    const { data: avail, error: availErr } = await isBusinessSlugAvailable(client, slug)
    if (availErr) return { ok: false, code: "unknown" }
    if (!avail) return { ok: false, code: "slug_taken" }
  }

  const taxNormalized = (() => {
    if (typeof input.taxId !== "string") return null
    const s = input.taxId.replace(/[\s-]/g, "").trim()
    return s.length > 0 ? s : null
  })()

  if (taxNormalized !== null && !isPolishNip10Valid(taxNormalized)) {
    return { ok: false, code: "tax_id_invalid" }
  }

  const phoneTrimmed = input.phone.trim()
  const phoneNormalized = phoneTrimmed ? phoneTrimmed.replace(/\D/g, "") : null
  const emailTrimmed = input.email.trim() || null

  const conflict = await findIdentityConflict(
    user.id,
    taxNormalized,
    phoneNormalized,
    emailTrimmed
  )
  if (conflict) return { ok: false, code: conflict }

  const patch = {
    business_name: input.businessName.trim(),
    slug,
    email: emailTrimmed,
    phone: phoneTrimmed || null,
    tax_id: taxNormalized,
    // Kanoniczne kolumny używane przez signup-side duplicate-check.
    // Brakujące kolumny w starych instancjach DB zostaną automatycznie zdjęte
    // przez tryUpdateWithSchemaFallback / tryInsertWithSchemaFallback.
    company_tax_id: taxNormalized,
    company_tax_id_normalized: taxNormalized,
    contact_phone: phoneTrimmed || null,
    contact_phone_normalized: phoneNormalized,
    default_reminder_hours: input.defaultReminderHours,
    second_reminder_minutes: input.secondReminderMinutes,
    reminder_channel: input.reminderChannel,
  }

  if (existing) {
    const { error } = await tryUpdateWithSchemaFallback(client, user.id, patch)
    if (error?.code === "23505") return { ok: false, code: "slug_taken" }
    if (error) return { ok: false, code: "unknown", details: error.message }
  } else {
    const { error } = await tryInsertWithSchemaFallback(client, {
      owner_id: user.id,
      business_name: patch.business_name,
      slug: patch.slug,
      owner_name: null,
      email: patch.email,
      phone: patch.phone,
      tax_id: patch.tax_id,
      company_tax_id: patch.company_tax_id,
      company_tax_id_normalized: patch.company_tax_id_normalized,
      contact_phone: patch.contact_phone,
      contact_phone_normalized: patch.contact_phone_normalized,
      default_reminder_hours: patch.default_reminder_hours,
      second_reminder_minutes: patch.second_reminder_minutes,
      reminder_channel: patch.reminder_channel,
    })
    if (error?.code === "23505") return { ok: false, code: "slug_taken" }
    if (error) return { ok: false, code: "unknown", details: error.message }
  }

  revalidatePath("/settings")
  return { ok: true }
}
