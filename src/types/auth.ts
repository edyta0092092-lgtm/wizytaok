import type { User } from "@supabase/supabase-js"

import type { BusinessProfileRecord } from "@/types/domain"

/**
 * Zalogowany użytkownik (Supabase Auth) + profil firmy z `business_profiles` (1:1 z owner_id).
 * `business` może być null przed uzupełnieniem profilu.
 */
export type AuthenticatedBusinessContext = {
  user: User
  business: BusinessProfileRecord | null
}
