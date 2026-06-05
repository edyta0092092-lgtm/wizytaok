import { getGoogleCalendarOAuthStateSecret } from "@/lib/integrations/google-calendar/config"
import { signOAuthState, verifyOAuthState } from "@/lib/integrations/google-calendar/token-crypto"

const MAX_AGE_MS = 15 * 60 * 1000

export type GoogleCalendarOAuthState = {
  userId: string
  businessId: string
  ts: number
}

export function encodeGoogleCalendarOAuthState(input: GoogleCalendarOAuthState): string | null {
  const secret = getGoogleCalendarOAuthStateSecret()
  if (!secret || secret.length < 16) return null
  const payloadB64 = Buffer.from(JSON.stringify(input), "utf8").toString("base64url")
  const sig = signOAuthState(payloadB64, secret)
  return `${payloadB64}.${sig}`
}

export function decodeGoogleCalendarOAuthState(state: string): GoogleCalendarOAuthState | null {
  const secret = getGoogleCalendarOAuthStateSecret()
  if (!secret || secret.length < 16) return null
  const [payloadB64, sig] = state.split(".")
  if (!payloadB64 || !sig) return null
  if (!verifyOAuthState(payloadB64, sig, secret)) return null
  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as GoogleCalendarOAuthState
    if (!parsed?.userId || !parsed?.businessId || typeof parsed.ts !== "number") return null
    if (Date.now() - parsed.ts > MAX_AGE_MS) return null
    return parsed
  } catch {
    return null
  }
}
