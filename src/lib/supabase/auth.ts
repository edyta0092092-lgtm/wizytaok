/**
 * Serwerowe odczyty Supabase Auth + profil firmy (`business_profiles`).
 */
import type { User } from "@supabase/supabase-js"

import { getBusinessProfileByOwnerId } from "@/lib/supabase/repositories/business-profile.repository"
import { getServerClient } from "@/lib/supabase/server"
import type { AuthenticatedBusinessContext } from "@/types/auth"

/** Zwraca użytkownika z JWT (getUser), bez ufanego samego getSession na serwerze. */
export async function getServerAuthUser(): Promise<User | null> {
  const client = await getServerClient()
  if (!client) return null
  const {
    data: { user },
    error,
  } = await client.auth.getUser()
  if (error || !user) return null
  return user
}

/**
 * Kontekst dla panelu: zalogowany użytkownik + ewentualny rekord `business_profiles`.
 * Zwraca `null`, gdy brak Supabase, błąd auth lub brak zalogowanego użytkownika.
 */
export async function getServerAuthWithBusiness(): Promise<AuthenticatedBusinessContext | null> {
  const client = await getServerClient()
  if (!client) return null

  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser()
  if (authError || !user) return null

  const { data: business, error: businessError } = await getBusinessProfileByOwnerId(
    client,
    user.id
  )
  if (businessError) {
    return { user, business: null }
  }

  return { user, business: business ?? null }
}
