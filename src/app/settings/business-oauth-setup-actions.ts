"use server"

import { revalidatePath } from "next/cache"

import { allocateSignupBookingSlug } from "@/lib/business/allocate-signup-slug"
import {
  ACCOUNT_TYPE_REGISTERED,
  ACCOUNT_TYPE_UNREGISTERED,
  type BusinessAccountType,
} from "@/lib/billing/account-types"
import { parseOwnerNameFromUserMetadata } from "@/lib/auth/oauth-user-prefill"
import { isPolishNip10Valid } from "@/lib/validation/polish-nip"
import { getServerAuthUser } from "@/lib/supabase/auth"
import {
  getBusinessProfileByOwnerId,
  insertBusinessProfile,
  updateBusinessProfileByOwnerId,
} from "@/lib/supabase/repositories/business-profile.repository"
import { getServerClient } from "@/lib/supabase/server"
import { getServiceRoleClient } from "@/lib/supabase/service-role"

export type OAuthSetupAccountType = BusinessAccountType

export type CompleteOAuthBusinessSetupInput = {
  businessName: string
  email: string
  phone: string
  accountType: OAuthSetupAccountType
  taxId: string | null
  ownerFirstName: string
  ownerLastName: string
}

export type CompleteOAuthBusinessSetupResult =
  | { ok: true }
  | {
      ok: false
      code:
        | "unauthorized"
        | "unknown"
        | "slug_invalid"
        | "slug_taken"
        | "tax_id_invalid"
        | "identity_conflict"
        | "missing_business_name"
        | "missing_phone"
        | "missing_tax_id"
        | "missing_owner_name"
        | "profile_exists"
      details?: string
    }

async function findIdentityConflict(
  ownerId: string,
  taxIdNormalized: string | null,
  contactPhoneNormalized: string | null,
  email: string | null,
): Promise<boolean> {
  const admin = getServiceRoleClient()
  if (!admin) return false

  if (taxIdNormalized && taxIdNormalized.length > 0) {
    const { data } = await admin
      .from("business_profiles")
      .select("owner_id")
      .eq("company_tax_id_normalized", taxIdNormalized)
      .neq("owner_id", ownerId)
      .limit(1)
    if (data && data.length > 0) return true
  }

  if (contactPhoneNormalized && contactPhoneNormalized.length > 0) {
    const { data } = await admin
      .from("business_profiles")
      .select("owner_id")
      .eq("contact_phone_normalized", contactPhoneNormalized)
      .neq("owner_id", ownerId)
      .limit(1)
    if (data && data.length > 0) return true
  }

  if (email && email.length > 0) {
    const { data } = await admin
      .from("business_profiles")
      .select("owner_id")
      .ilike("email", email)
      .neq("owner_id", ownerId)
      .limit(1)
    if (data && data.length > 0) return true
  }

  return false
}

function getMissingColumn(message: string | undefined): string | null {
  const match = String(message ?? "").match(/'([^']+)' column of 'business_profiles'/i)
  return match?.[1] ?? null
}

async function insertWithFallback(
  client: NonNullable<Awaited<ReturnType<typeof getServerClient>>>,
  payload: Record<string, unknown>,
) {
  let p = { ...payload }
  for (let i = 0; i < 5; i += 1) {
    const { error } = await insertBusinessProfile(client, p as never)
    if (!error) return { error: null as null }
    const missing = getMissingColumn(error.message)
    if (!missing || !(missing in p)) return { error }
    p = Object.fromEntries(Object.entries(p).filter(([k]) => k !== missing))
  }
  return { error: { message: "insert failed" } }
}

async function updateWithFallback(
  client: NonNullable<Awaited<ReturnType<typeof getServerClient>>>,
  ownerId: string,
  payload: Record<string, unknown>,
) {
  let p = { ...payload }
  for (let i = 0; i < 5; i += 1) {
    const { error } = await updateBusinessProfileByOwnerId(client, ownerId, p as never)
    if (!error) return { error: null as null }
    const missing = getMissingColumn(error.message)
    if (!missing || !(missing in p)) return { error }
    p = Object.fromEntries(Object.entries(p).filter(([k]) => k !== missing))
  }
  return { error: { message: "update failed" } }
}

/**
 * Pierwsze uzupełnienie firmy po OAuth — profil + user_metadata (account_type itd.).
 */
export async function completeOAuthBusinessSetupAction(
  input: CompleteOAuthBusinessSetupInput,
): Promise<CompleteOAuthBusinessSetupResult> {
  const user = await getServerAuthUser()
  if (!user) return { ok: false, code: "unauthorized" }

  const client = await getServerClient()
  if (!client) return { ok: false, code: "unknown" }

  const businessName = input.businessName.trim()
  if (!businessName) return { ok: false, code: "missing_business_name" }

  const ownerFirst = input.ownerFirstName.trim()
  const ownerLast = input.ownerLastName.trim()
  if (!ownerFirst || !ownerLast) return { ok: false, code: "missing_owner_name" }

  const accountType = input.accountType
  if (accountType !== ACCOUNT_TYPE_REGISTERED && accountType !== ACCOUNT_TYPE_UNREGISTERED) {
    return { ok: false, code: "unknown" }
  }

  const phoneTrimmed = input.phone.trim()
  const phoneNormalized = phoneTrimmed ? phoneTrimmed.replace(/\D/g, "") : null
  if (!phoneNormalized || phoneNormalized.length < 9) {
    return { ok: false, code: "missing_phone" }
  }

  const emailTrimmed = input.email.trim() || null

  let taxNormalized: string | null = null
  if (accountType === ACCOUNT_TYPE_REGISTERED) {
    const raw = (input.taxId ?? "").replace(/[\s-]/g, "").trim()
    if (raw.length !== 10 || !isPolishNip10Valid(raw)) {
      return { ok: false, code: taxIdInvalidOrMissing(raw) }
    }
    taxNormalized = raw
  }

  const conflict = await findIdentityConflict(user.id, taxNormalized, phoneNormalized, emailTrimmed)
  if (conflict) return { ok: false, code: "identity_conflict" }

  const { data: existing } = await getBusinessProfileByOwnerId(client, user.id)
  const { data: existingRaw } = await client
    .from("business_profiles")
    .select("id, slug, account_type")
    .eq("owner_id", user.id)
    .maybeSingle()

  if (
    existingRaw?.id &&
    existing?.businessName?.trim() &&
    typeof existingRaw.account_type === "string" &&
    existingRaw.account_type.trim().length > 0
  ) {
    return { ok: false, code: "profile_exists" }
  }

  const ownerNameCombined = [ownerFirst, ownerLast].filter(Boolean).join(" ").trim()

  let slug = existingRaw?.slug?.trim() ?? existing?.slug?.trim() ?? ""
  if (!slug) {
    const allocated = await allocateSignupBookingSlug(client, businessName)
    if (!allocated.ok) return { ok: false, code: "slug_taken" }
    slug = allocated.slug
  }

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const trialIntent = meta.trial_intent

  const profilePatch: Record<string, unknown> = {
    business_name: businessName,
    slug,
    email: emailTrimmed,
    phone: phoneTrimmed,
    tax_id: taxNormalized,
    company_tax_id: taxNormalized,
    company_tax_id_normalized: taxNormalized,
    contact_phone: phoneTrimmed,
    contact_phone_normalized: phoneNormalized,
    account_type: accountType,
    owner_name: ownerNameCombined,
    owner_last_name: ownerLast,
    default_reminder_hours: 24,
    second_reminder_minutes: 120,
    reminder_channel: "both",
  }

  if (existingRaw?.id) {
    const { error } = await updateWithFallback(client, user.id, profilePatch)
    if (error) {
      const pgCode = (error as { code?: string }).code
      return {
        ok: false,
        code: pgCode === "23505" ? "slug_taken" : "unknown",
        details: (error as { message?: string }).message,
      }
    }
  } else {
    const { error } = await insertWithFallback(client, {
      owner_id: user.id,
      ...profilePatch,
    })
    if (error) {
      const pgCode = (error as { code?: string }).code
      return {
        ok: false,
        code: pgCode === "23505" ? "slug_taken" : "unknown",
        details: (error as { message?: string }).message,
      }
    }
  }

  try {
    await client.rpc("ensure_owner_membership")
  } catch {
    /* starsze bazy bez RPC */
  }

  const metadataPatch: Record<string, unknown> = {
    account_type: accountType,
    business_name: businessName,
    owner_name: ownerFirst,
    owner_last_name: ownerLast,
    company_tax_id: accountType === ACCOUNT_TYPE_REGISTERED ? (taxNormalized ?? "") : "",
    company_tax_id_normalized:
      accountType === ACCOUNT_TYPE_REGISTERED ? (taxNormalized ?? "") : "",
    contact_phone: phoneTrimmed,
    contact_phone_normalized: phoneNormalized,
  }
  if (trialIntent !== undefined) {
    metadataPatch.trial_intent = trialIntent
  }

  const { error: metaErr } = await client.auth.updateUser({ data: metadataPatch })
  if (metaErr) {
    console.error("[oauth-setup] updateUser metadata", metaErr.message)
  }

  revalidatePath("/settings")
  return { ok: true }
}

function taxIdInvalidOrMissing(raw: string): "missing_tax_id" | "tax_id_invalid" {
  if (!raw) return "missing_tax_id"
  return "tax_id_invalid"
}

/** Wstępne dane formularza setupu z sesji (server). */
export async function loadOAuthSetupPrefillAction(): Promise<{
  email: string
  firstName: string
  lastName: string
  hasProfile: boolean
}> {
  const user = await getServerAuthUser()
  if (!user) {
    return { email: "", firstName: "", lastName: "", hasProfile: false }
  }
  const names = parseOwnerNameFromUserMetadata(user.user_metadata as Record<string, unknown>)
  const client = await getServerClient()
  let hasProfile = false
  if (client) {
    const { data } = await getBusinessProfileByOwnerId(client, user.id)
    hasProfile = Boolean(data?.id && data.businessName?.trim())
  }
  return {
    email: user.email?.trim() ?? "",
    firstName: names.firstName,
    lastName: names.lastName,
    hasProfile,
  }
}
