const REFERRAL_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

export const REFERRAL_CODE_LENGTH = 6
export const REFERRAL_COOKIE_NAME = "wizytaok_referral_code"
export const REFERRAL_STORAGE_KEY = "wizytaok_referral_code"

export function normalizeReferralCode(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null
  const normalized = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
  if (normalized.length < 4 || normalized.length > 12) return null
  return normalized
}

export function generateReferralCode(length = REFERRAL_CODE_LENGTH): string {
  let out = ""
  for (let i = 0; i < length; i += 1) {
    const idx = Math.floor(Math.random() * REFERRAL_CODE_CHARS.length)
    out += REFERRAL_CODE_CHARS[idx]
  }
  return out
}

export function buildReferralSignupUrl(code: string, origin?: string): string {
  const base = (origin ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://wizytaok.pl").replace(/\/$/, "")
  return `${base}/rejestracja?ref=${encodeURIComponent(code)}`
}
