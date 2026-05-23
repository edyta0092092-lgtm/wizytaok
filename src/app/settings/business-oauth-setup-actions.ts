"use server"

import { revalidatePath } from "next/cache"
import type { PostgrestError } from "@supabase/supabase-js"

import { allocateSignupBookingSlug } from "@/lib/business/allocate-signup-slug"
import {
  ACCOUNT_TYPE_REGISTERED,
  ACCOUNT_TYPE_UNREGISTERED,
  type BusinessAccountType,
} from "@/lib/billing/account-types"
import { logOAuthBusinessSetupError } from "@/lib/auth/oauth-business-setup-log"
import { parseOwnerNameFromUserMetadata } from "@/lib/auth/oauth-user-prefill"
import { resolvePostBusinessSetupRedirect } from "@/lib/auth/post-business-setup-redirect-server"
import { isPolishNip10Valid } from "@/lib/validation/polish-nip"
import { getServerAuthUser } from "@/lib/supabase/auth"
import { getServerClient } from "@/lib/supabase/server"
import { getServiceRoleClient } from "@/lib/supabase/service-role"
import type { Database } from "@/types/database"

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
  | { ok: true; businessId: string; redirectTo: string }
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

function isProfileSetupComplete(
  row: Database["public"]["Tables"]["business_profiles"]["Row"] | null,
): boolean {
  if (!row?.id) return false
  const name = typeof row.business_name === "string" ? row.business_name.trim() : ""
  if (!name) return false
  const accountType = typeof row.account_type === "string" ? row.account_type.trim() : ""
  if (accountType !== ACCOUNT_TYPE_REGISTERED && accountType !== ACCOUNT_TYPE_UNREGISTERED) {
    return false
  }
  const phone =
    (typeof row.contact_phone_normalized === "string" ? row.contact_phone_normalized : "").replace(
      /\D/g,
      "",
    ) ||
    (typeof row.phone === "string" ? row.phone : "").replace(/\D/g, "")
  return phone.length >= 9
}

async function insertWithFallback(
  admin: NonNullable<ReturnType<typeof getServiceRoleClient>>,
  payload: Record<string, unknown>,
) {
  let p = { ...payload }
  for (let i = 0; i < 5; i += 1) {
    const { data, error } = await admin
      .from("business_profiles")
      .insert(p as Database["public"]["Tables"]["business_profiles"]["Insert"])
      .select("id")
      .single()
    if (!error && data?.id) return { data, error: null as null }
    if (!error) return { data: null, error: { message: "insert returned no row" } as PostgrestError }
    const missing = getMissingColumn(error.message)
    if (!missing || !(missing in p)) {
      logOAuthBusinessSetupError("insert business_profiles", error)
      return { data: null, error }
    }
    p = Object.fromEntries(Object.entries(p).filter(([k]) => k !== missing))
  }
  return { data: null, error: { message: "insert failed" } as PostgrestError }
}

async function updateWithFallback(
  admin: NonNullable<ReturnType<typeof getServiceRoleClient>>,
  ownerId: string,
  payload: Record<string, unknown>,
) {
  let p = { ...payload }
  for (let i = 0; i < 5; i += 1) {
    const { data, error } = await admin
      .from("business_profiles")
      .update(p as Database["public"]["Tables"]["business_profiles"]["Update"])
      .eq("owner_id", ownerId)
      .select("*")
      .single()
    if (!error && data?.id) return { data, error: null as null }
    if (!error) return { data: null, error: { message: "update returned no row" } as PostgrestError }
    const missing = getMissingColumn(error.message)
    if (!missing || !(missing in p)) {
      logOAuthBusinessSetupError("update business_profiles", error)
      return { data: null, error }
    }
    p = Object.fromEntries(Object.entries(p).filter(([k]) => k !== missing))
  }
  return { data: null, error: { message: "update failed" } as PostgrestError }
}

function revalidateOAuthSetupPaths(): void {
  revalidatePath("/settings")
  revalidatePath("/dashboard")
  revalidatePath("/activate-access")
  revalidatePath("/start-trial")
}

/**
 * Pierwsze uzupełnienie firmy po OAuth — profil w business_profiles + user_metadata.
 */
export async function completeOAuthBusinessSetupAction(
  input: CompleteOAuthBusinessSetupInput,
): Promise<CompleteOAuthBusinessSetupResult> {
  const user = await getServerAuthUser()
  if (!user) return { ok: false, code: "unauthorized" }

  const client = await getServerClient()
  if (!client) return { ok: false, code: "unknown" }

  const admin = getServiceRoleClient()
  if (!admin) {
    logOAuthBusinessSetupError("missing service role", "SUPABASE_SERVICE_ROLE_KEY")
    return { ok: false, code: "unknown", details: "service_role_unconfigured" }
  }

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

  const { data: existingRow, error: existingErr } = await admin
    .from("business_profiles")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle()

  if (existingErr) {
    logOAuthBusinessSetupError("select existing profile", existingErr)
    return { ok: false, code: "unknown", details: existingErr.message }
  }

  if (isProfileSetupComplete(existingRow)) {
    const redirectTo = await resolvePostBusinessSetupRedirect(user, existingRow)
    revalidateOAuthSetupPaths()
    return { ok: true, businessId: existingRow!.id, redirectTo }
  }

  const ownerNameCombined = [ownerFirst, ownerLast].filter(Boolean).join(" ").trim()

  let slug = existingRow?.slug?.trim() ?? ""
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
    contact_phone: phoneTrimmed,
    contact_phone_normalized: phoneNormalized,
    account_type: accountType,
    owner_name: ownerNameCombined,
    owner_last_name: ownerLast,
    default_reminder_hours: 24,
    second_reminder_minutes: 120,
    reminder_channel: "both",
  }

  if (accountType === ACCOUNT_TYPE_REGISTERED) {
    profilePatch.tax_id = taxNormalized
    profilePatch.company_tax_id = taxNormalized
    profilePatch.company_tax_id_normalized = taxNormalized
  } else {
    profilePatch.tax_id = null
    profilePatch.company_tax_id = null
    profilePatch.company_tax_id_normalized = null
  }

  let savedRow: Database["public"]["Tables"]["business_profiles"]["Row"] | null = null

  if (existingRow?.id) {
    const { data, error } = await updateWithFallback(admin, user.id, profilePatch)
    if (error) {
      const pgCode = error.code
      return {
        ok: false,
        code: pgCode === "23505" ? "slug_taken" : "unknown",
        details: error.message,
      }
    }
    savedRow = data
  } else {
    const { data, error } = await insertWithFallback(admin, {
      owner_id: user.id,
      ...profilePatch,
    })
    if (error) {
      const pgCode = error.code
      return {
        ok: false,
        code: pgCode === "23505" ? "slug_taken" : "unknown",
        details: error.message,
      }
    }
    if (!data?.id) {
      return { ok: false, code: "unknown", details: "insert_missing_id" }
    }
    const { data: loaded, error: loadErr } = await admin
      .from("business_profiles")
      .select("*")
      .eq("id", data.id)
      .maybeSingle()
    if (loadErr || !loaded?.id) {
      logOAuthBusinessSetupError("reload after insert", loadErr ?? "no row")
      return { ok: false, code: "unknown", details: loadErr?.message ?? "profile_not_found" }
    }
    savedRow = loaded
  }

  try {
    await client.rpc("ensure_owner_membership")
  } catch (err) {
    logOAuthBusinessSetupError("ensure_owner_membership (user client)", err)
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
    logOAuthBusinessSetupError("updateUser metadata", metaErr)
  }

  revalidateOAuthSetupPaths()

  const redirectTo = await resolvePostBusinessSetupRedirect(user, savedRow)
  return { ok: true, businessId: savedRow.id, redirectTo }
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
  redirectTo?: string
  businessId?: string
}> {
  const user = await getServerAuthUser()
  if (!user) {
    return { email: "", firstName: "", lastName: "", hasProfile: false }
  }
  const names = parseOwnerNameFromUserMetadata(user.user_metadata as Record<string, unknown>)
  const admin = getServiceRoleClient()
  if (!admin) {
    return {
      email: user.email?.trim() ?? "",
      firstName: names.firstName,
      lastName: names.lastName,
      hasProfile: false,
    }
  }
  const { data: row } = await admin
    .from("business_profiles")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle()

  const hasProfile = isProfileSetupComplete(row)
  if (hasProfile && row) {
    const redirectTo = await resolvePostBusinessSetupRedirect(user, row)
    return {
      email: user.email?.trim() ?? "",
      firstName: names.firstName,
      lastName: names.lastName,
      hasProfile: true,
      redirectTo,
      businessId: row.id,
    }
  }
  return {
    email: user.email?.trim() ?? "",
    firstName: names.firstName,
    lastName: names.lastName,
    hasProfile: false,
  }
}
