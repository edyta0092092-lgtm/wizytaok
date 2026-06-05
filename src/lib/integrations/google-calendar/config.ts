/** OAuth kalendarza — osobne od logowania Supabase (Google Sign-In). */
export function isGoogleCalendarOAuthConfigured(): boolean {
  const id = process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim()
  const secret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim()
  return Boolean(id && secret)
}

export function getGoogleCalendarClientId(): string {
  return process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim() ?? ""
}

export function getGoogleCalendarClientSecret(): string {
  return process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim() ?? ""
}

export function isGoogleCalendarTokenEncryptionConfigured(): boolean {
  const key = process.env.GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY?.trim()
  return Boolean(key && key.length >= 32)
}

export function getGoogleCalendarOAuthStateSecret(): string {
  return (
    process.env.GOOGLE_CALENDAR_OAUTH_STATE_SECRET?.trim() ||
    process.env.GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY?.trim() ||
    ""
  )
}

export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "openid",
  "email",
] as const

export function buildGoogleCalendarRedirectUri(origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/integrations/google-calendar/callback`
}
