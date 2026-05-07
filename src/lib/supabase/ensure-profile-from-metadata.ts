import type { SupabaseClient } from "@supabase/supabase-js"

import { isValidPublicSlugFormat, normalizePublicSlug } from "@/lib/business/slug"
import type { Database } from "@/types/database"

/**
 * Po potwierdzeniu e-maila (auth callback) tworzy `business_profiles` z `user_metadata`, jeśli brak wiersza.
 */
export async function ensureBusinessProfileFromUserMetadata(
  supabase: SupabaseClient<Database>
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const { data: existing } = await supabase
    .from("business_profiles")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle()
  if (existing) return

  const meta = user.user_metadata ?? {}
  const slug = typeof meta.slug === "string" ? normalizePublicSlug(meta.slug) : ""
  const businessName =
    typeof meta.business_name === "string" ? meta.business_name.trim() : ""

  if (!businessName || !slug || !isValidPublicSlugFormat(slug)) return

  const ownerNameRaw = typeof meta.owner_name === "string" ? meta.owner_name.trim() : ""
  const ownerName = ownerNameRaw.length > 0 ? ownerNameRaw : null

  await supabase.from("business_profiles").insert({
    owner_id: user.id,
    business_name: businessName,
    slug,
    email: user.email ?? null,
    owner_name: ownerName,
  })
}
