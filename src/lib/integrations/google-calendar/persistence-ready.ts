import {
  isGoogleCalendarOAuthConfigured,
  isGoogleCalendarTokenEncryptionConfigured,
} from "@/lib/integrations/google-calendar/config"
import { getServiceRoleClient } from "@/lib/supabase/service-role"

let cachedReady: boolean | null = null
let cachedAt = 0
const CACHE_MS = 60_000

/** Czy migracja `google_calendar_connections` jest wdrożona w bazie. */
export async function isGoogleCalendarPersistenceReady(): Promise<boolean> {
  if (!isGoogleCalendarOAuthConfigured() || !isGoogleCalendarTokenEncryptionConfigured()) {
    return false
  }
  const now = Date.now()
  if (cachedReady !== null && now - cachedAt < CACHE_MS) {
    return cachedReady
  }
  const admin = getServiceRoleClient()
  if (!admin) {
    cachedReady = false
    cachedAt = now
    return false
  }
  const { error } = await admin.from("google_calendar_connections").select("id").limit(1)
  const ready = !error
  cachedReady = ready
  cachedAt = now
  return ready
}

export function invalidateGoogleCalendarPersistenceCache(): void {
  cachedReady = null
  cachedAt = 0
}
