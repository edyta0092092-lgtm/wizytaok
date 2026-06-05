import {
  connectionEncryptedPayload,
  loadActiveConnectionForUser,
} from "@/lib/integrations/google-calendar/connection-repository"
import { refreshGoogleAccessToken } from "@/lib/integrations/google-calendar/google-oauth-client"
import { decryptRefreshToken } from "@/lib/integrations/google-calendar/token-crypto"

export async function getGoogleCalendarAccessToken(
  businessId: string,
  userId: string,
): Promise<{ accessToken: string; calendarId: string } | null> {
  const row = await loadActiveConnectionForUser(businessId, userId)
  if (!row?.google_calendar_id) return null
  const refresh = decryptRefreshToken(connectionEncryptedPayload(row))
  if (!refresh) return null
  const tokens = await refreshGoogleAccessToken(refresh)
  if (!tokens?.access_token) return null
  return { accessToken: tokens.access_token, calendarId: row.google_calendar_id }
}
