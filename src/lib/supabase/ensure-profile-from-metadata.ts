import type { SupabaseClient, User } from "@supabase/supabase-js"

import { isValidPublicSlugFormat, normalizePublicSlug } from "@/lib/business/slug"
import type { Database } from "@/types/database"

type EnsureProfileResult = {
  businessProfileCreated: boolean
  membershipCreated: boolean
}

export type BusinessProfileInsertPlan = {
  fullInsert: Database["public"]["Tables"]["business_profiles"]["Insert"]
  ownerNameLegacyFallback: string | null
  companyTaxIdRaw: string | null
}

function buildFallbackSlug(userId: string): string {
  const suffix = userId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toLowerCase()
  return normalizePublicSlug(`moja-firma-${suffix || "new"}`) || "moja-firma-new"
}

function normalizeDigits(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const normalized = raw.replace(/\D/g, "")
  return normalized.length > 0 ? normalized : null
}

function isMissingColumnError(message: string | undefined): boolean {
  const m = (message ?? "").toLowerCase()
  return m.includes("column") && (m.includes("does not exist") || m.includes("schema cache"))
}

const isUniqueViolation = (msg: string | undefined): boolean => {
  const m = (msg ?? "").toLowerCase()
  return m.includes("duplicate") || m.includes("unique") || m.includes("already exists")
}

/**
 * Plan wstawienia `business_profiles` z `user.user_metadata` (signup / callback).
 */
export function planBusinessProfileInsertFromUser(
  user: User,
  allowFallbackProfile: boolean
): BusinessProfileInsertPlan | null {
  const meta = user.user_metadata ?? {}
  const normalizedSlugCandidate =
    typeof meta.slug === "string" ? normalizePublicSlug(meta.slug) : ""
  const hasValidMetadataSlug = isValidPublicSlugFormat(normalizedSlugCandidate)
  const slug = hasValidMetadataSlug
    ? normalizedSlugCandidate
    : allowFallbackProfile
      ? buildFallbackSlug(user.id)
      : ""
  const businessNameRaw =
    typeof meta.business_name === "string" ? meta.business_name.trim() : ""
  const businessName =
    businessNameRaw.length > 0 ? businessNameRaw : allowFallbackProfile ? "Moja firma" : ""

  if (!slug || !isValidPublicSlugFormat(slug)) {
    return null
  }
  if (!businessName) {
    return null
  }

  const ownerFirstRaw = typeof meta.owner_name === "string" ? meta.owner_name.trim() : ""
  const ownerLastRaw =
    typeof meta.owner_last_name === "string" ? meta.owner_last_name.trim() : ""
  const ownerFirst = ownerFirstRaw.length > 0 ? ownerFirstRaw : null
  const ownerLast = ownerLastRaw.length > 0 ? ownerLastRaw : null
  const accountTypeRaw = typeof meta.account_type === "string" ? meta.account_type.trim() : ""
  const accountType =
    accountTypeRaw === "registered_business" || accountTypeRaw === "unregistered_activity"
      ? accountTypeRaw
      : null
  const companyTaxIdRaw = typeof meta.company_tax_id === "string" ? meta.company_tax_id.trim() : ""
  const companyTaxIdNormalized =
    normalizeDigits(meta.company_tax_id_normalized) ?? normalizeDigits(companyTaxIdRaw)
  const contactPhoneRaw = typeof meta.contact_phone === "string" ? meta.contact_phone.trim() : ""
  const contactPhoneNormalized =
    normalizeDigits(meta.contact_phone_normalized) ?? normalizeDigits(contactPhoneRaw)

  const fullInsert: Database["public"]["Tables"]["business_profiles"]["Insert"] = {
    owner_id: user.id,
    business_name: businessName,
    slug,
    email: user.email ?? null,
    owner_name: ownerFirst,
    owner_last_name: ownerLast,
    tax_id: companyTaxIdRaw || null,
    account_type: accountType,
    company_tax_id: companyTaxIdRaw || null,
    company_tax_id_normalized: companyTaxIdNormalized,
    contact_phone: contactPhoneRaw || null,
    contact_phone_normalized: contactPhoneNormalized,
  }

  const ownerNameLegacyFallback =
    [ownerFirst, ownerLast].filter((s): s is string => s != null && s.length > 0).join(" ") || null

  return {
    fullInsert,
    ownerNameLegacyFallback,
    companyTaxIdRaw,
  }
}

/**
 * Jedna próba utworzenia wiersza (insert + fallback przy braku kolumn / kolizji sluga).
 */
export async function insertBusinessProfileFromPlan(
  supabase: SupabaseClient<Database>,
  userId: string,
  plan: BusinessProfileInsertPlan,
  allowFallbackProfile: boolean
): Promise<boolean> {
  const { fullInsert, ownerNameLegacyFallback, companyTaxIdRaw } = plan
  let insertSlug = fullInsert.slug
  let { error: insertError } = await supabase.from("business_profiles").insert(fullInsert)
  if (insertError && isMissingColumnError(insertError.message)) {
    const { error: fallbackError } = await supabase.from("business_profiles").insert({
      owner_id: userId,
      business_name: fullInsert.business_name,
      slug: insertSlug,
      email: fullInsert.email ?? null,
      owner_name: ownerNameLegacyFallback,
      tax_id: companyTaxIdRaw || null,
    })
    insertError = fallbackError ?? null
  }

  if (insertError && allowFallbackProfile && isUniqueViolation(insertError.message)) {
    insertSlug = buildFallbackSlug(userId)
    const retryPayload = { ...fullInsert, slug: insertSlug }
    const retry = await supabase.from("business_profiles").insert(retryPayload)
    insertError = retry.error
    if (insertError && isMissingColumnError(insertError.message)) {
      const { error: fallbackError } = await supabase.from("business_profiles").insert({
        owner_id: userId,
        business_name: fullInsert.business_name,
        slug: insertSlug,
        email: fullInsert.email ?? null,
        owner_name: ownerNameLegacyFallback,
        tax_id: companyTaxIdRaw || null,
      })
      insertError = fallbackError ?? null
    }
  }

  return !insertError
}

/**
 * Po potwierdzeniu e-maila (auth callback) tworzy `business_profiles` z `user_metadata`, jeśli brak wiersza.
 */
export async function ensureBusinessProfileFromUserMetadata(
  supabase: SupabaseClient<Database>,
  options?: { allowFallbackProfile?: boolean }
): Promise<EnsureProfileResult> {
  let businessProfileCreated = false
  let membershipCreated = false

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { businessProfileCreated, membershipCreated }

  const { data: existing } = await supabase
    .from("business_profiles")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle()
  if (existing?.id) {
    await supabase.rpc("ensure_owner_membership")
    membershipCreated = true
    return { businessProfileCreated, membershipCreated }
  }

  const allowFallbackProfile = options?.allowFallbackProfile === true
  const plan = planBusinessProfileInsertFromUser(user, allowFallbackProfile)
  if (!plan) {
    return { businessProfileCreated, membershipCreated }
  }

  const inserted = await insertBusinessProfileFromPlan(supabase, user.id, plan, allowFallbackProfile)
  if (inserted) {
    businessProfileCreated = true
  }

  await supabase.rpc("ensure_owner_membership")
  membershipCreated = true

  return { businessProfileCreated, membershipCreated }
}
