import {
  isGoogleCalendarOAuthConfigured,
  isGoogleCalendarTokenEncryptionConfigured,
} from "@/lib/integrations/google-calendar/config"
import { probeGoogleCalendarTableViaRest } from "@/lib/integrations/google-calendar/database-ready"
import { getServiceRoleClient } from "@/lib/supabase/service-role"

let cachedReady: boolean | null = null
let cachedAt = 0
const CACHE_MS = 60_000

export function isGoogleCalendarServerConfigured(): boolean {
  return isGoogleCalendarOAuthConfigured() && isGoogleCalendarTokenEncryptionConfigured()
}

export function isGoogleCalendarServiceRoleConfigured(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
}

/** Czy migracja `google_calendar_connections` jest wdrożona w bazie. */
export async function isGoogleCalendarDatabaseReady(): Promise<boolean> {
  const now = Date.now()
  if (cachedReady !== null && now - cachedAt < CACHE_MS) {
    return cachedReady
  }

  const admin = getServiceRoleClient()
  if (admin) {
    const { error } = await admin.from("google_calendar_connections").select("id").limit(1)
    cachedReady = !error
    cachedAt = now
    return cachedReady
  }

  const probed = await probeGoogleCalendarTableViaRest()
  if (probed !== null) {
    cachedReady = probed
    cachedAt = now
    return probed
  }

  cachedReady = false
  cachedAt = now
  return false
}

export async function isGoogleCalendarPersistenceReady(): Promise<boolean> {
  if (!isGoogleCalendarServerConfigured()) return false
  if (!isGoogleCalendarServiceRoleConfigured()) return false
  return isGoogleCalendarDatabaseReady()
}

export function invalidateGoogleCalendarPersistenceCache(): void {
  cachedReady = null
  cachedAt = 0
}
