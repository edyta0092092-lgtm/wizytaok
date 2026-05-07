/**
 * Jedno miejsce na odczyt użytkownika i profilu firmy (Server Components / actions).
 */
import { getServerAuthUser } from "@/lib/supabase/auth"
import { getServerClient } from "@/lib/supabase/server"
import {
  getBusinessProfileByOwnerId,
  getPublicBusinessProfileBySlug,
} from "@/lib/supabase/repositories/business-profile.repository"
import type { BusinessProfileRecord, PublicBusinessProfileDisplay } from "@/types/domain"

export async function getCurrentUser() {
  return getServerAuthUser()
}

export async function getCurrentBusinessProfile(): Promise<BusinessProfileRecord | null> {
  const user = await getServerAuthUser()
  if (!user) return null
  const client = await getServerClient()
  const { data, error } = await getBusinessProfileByOwnerId(client, user.id)
  if (error || !data) return null
  return data
}

export async function getBusinessBySlug(
  slug: string
): Promise<PublicBusinessProfileDisplay | null> {
  const client = await getServerClient()
  if (!client) return null
  const { data, error } = await getPublicBusinessProfileBySlug(client, slug)
  if (error || !data) return null
  return data
}
