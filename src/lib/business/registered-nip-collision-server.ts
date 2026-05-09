import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/types/database"

/** Kolizja NIP przy rejestracji nowej „firmy”: bez duplikowania rekordów business_profiles przy obcym właścicielu. */
export type RegisteredNipCollisionOutcome =
  /** Brak innego biznesu z tym samym company_tax_id_normalized — można tworzyć profil. */
  | { outcome: "ok_to_insert" }
  /** Istniejący biznes z tym NIP; aktualny użytkownik jest już w business_members. */
  | {
      outcome: "member_of_existing_company"
      businessId: string
      subscriptionStatus: string | null
    }
  /** Istniejący biznes z tym NIP; użytkownik nie jest członkiem — blokada bez INSERT i bez podglądu danych. */
  | { outcome: "blocked_foreign_nip" }

export async function resolveRegisteredBusinessNipCollision(
  admin: SupabaseClient<Database>,
  currentUserId: string,
  companyTaxIdNormalized: string
): Promise<RegisteredNipCollisionOutcome> {
  const nip = companyTaxIdNormalized.replace(/\D/g, "")
  if (nip.length !== 10) {
    return { outcome: "ok_to_insert" }
  }

  const { data: rows, error } = await admin
    .from("business_profiles")
    .select("id, owner_id, subscription_status")
    .eq("company_tax_id_normalized", nip)

  if (error) {
    console.error("[resolveRegisteredBusinessNipCollision]", error.message)
    return { outcome: "ok_to_insert" }
  }

  const list = rows ?? []
  if (list.length === 0) {
    return { outcome: "ok_to_insert" }
  }

  for (const biz of list) {
    const { data: member } = await admin
      .from("business_members")
      .select("business_id")
      .eq("business_id", biz.id)
      .eq("user_id", currentUserId)
      .maybeSingle()

    if (member?.business_id) {
      return {
        outcome: "member_of_existing_company",
        businessId: biz.id,
        subscriptionStatus:
          typeof biz.subscription_status === "string" ? biz.subscription_status : null,
      }
    }
  }

  return { outcome: "blocked_foreign_nip" }
}
