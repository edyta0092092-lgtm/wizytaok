"use server"

import { revalidatePath } from "next/cache"

import { isValidPublicSlugFormat, normalizePublicSlug } from "@/lib/business/slug"
import { getServerAuthUser } from "@/lib/supabase/auth"
import {
  getBusinessProfileByOwnerId,
  insertBusinessProfile,
  isBusinessSlugAvailable,
  updateBusinessProfileByOwnerId,
} from "@/lib/supabase/repositories/business-profile.repository"
import { getServerClient } from "@/lib/supabase/server"

export type SaveBusinessProfileInput = {
  businessName: string
  slug: string
  ownerName: string
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
      code: "unauthorized" | "slug_invalid" | "slug_taken" | "unknown"
      details?: string
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

  const patch = {
    business_name: input.businessName.trim(),
    slug,
    owner_name: input.ownerName.trim() || null,
    email: input.email.trim() || null,
    phone: input.phone.trim() || null,
    tax_id: taxNormalized,
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
      owner_name: patch.owner_name,
      email: patch.email,
      phone: patch.phone,
      tax_id: patch.tax_id,
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
