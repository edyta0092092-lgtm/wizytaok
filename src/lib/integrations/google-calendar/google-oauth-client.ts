import {
  buildGoogleCalendarRedirectUri,
  getGoogleCalendarClientId,
  getGoogleCalendarClientSecret,
  GOOGLE_CALENDAR_SCOPES,
} from "@/lib/integrations/google-calendar/config"

export function buildGoogleCalendarAuthorizeUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: getGoogleCalendarClientId(),
    redirect_uri: buildGoogleCalendarRedirectUri(origin),
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

export type GoogleTokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
  scope?: string
}

export async function exchangeGoogleCalendarCode(
  origin: string,
  code: string,
): Promise<GoogleTokenResponse | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: getGoogleCalendarClientId(),
      client_secret: getGoogleCalendarClientSecret(),
      redirect_uri: buildGoogleCalendarRedirectUri(origin),
      grant_type: "authorization_code",
    }),
  })
  if (!res.ok) return null
  return (await res.json()) as GoogleTokenResponse
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<GoogleTokenResponse | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: getGoogleCalendarClientId(),
      client_secret: getGoogleCalendarClientSecret(),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  })
  if (!res.ok) return null
  return (await res.json()) as GoogleTokenResponse
}

export async function fetchGoogleUserEmail(accessToken: string): Promise<string | null> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return null
  const json = (await res.json()) as { email?: string }
  return typeof json.email === "string" ? json.email : null
}
