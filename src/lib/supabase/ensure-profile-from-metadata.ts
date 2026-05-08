import type { SupabaseClient } from "@supabase/supabase-js"

import { isValidPublicSlugFormat, normalizePublicSlug } from "@/lib/business/slug"
import type { Database } from "@/types/database"

type EnsureProfileResult = {
  businessProfileCreated: boolean
  membershipCreated: boolean
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

  const meta = user.user_metadata ?? {}
  const allowFallbackProfile = options?.allowFallbackProfile === true
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
    return { businessProfileCreated, membershipCreated }
  }
  if (!businessName) {
    return { businessProfileCreated, membershipCreated }
  }

  const ownerNameRaw = typeof meta.owner_name === "string" ? meta.owner_name.trim() : ""
  const ownerName = ownerNameRaw.length > 0 ? ownerNameRaw : null
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

  const { error: insertError } = await supabase.from("business_profiles").insert({
    owner_id: user.id,
    business_name: businessName,
    slug,
    email: user.email ?? null,
    owner_name: ownerName,
    tax_id: companyTaxIdRaw || null,
    account_type: accountType,
    company_tax_id: companyTaxIdRaw || null,
    company_tax_id_normalized: companyTaxIdNormalized,
    contact_phone: contactPhoneRaw || null,
    contact_phone_normalized: contactPhoneNormalized,
  })
  if (!insertError) {
    businessProfileCreated = true
  }

  await supabase.rpc("ensure_owner_membership")
  membershipCreated = true

  return { businessProfileCreated, membershipCreated }
}
