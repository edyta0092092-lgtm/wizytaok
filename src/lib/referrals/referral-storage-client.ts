import { normalizeReferralCode, REFERRAL_COOKIE_NAME, REFERRAL_STORAGE_KEY } from "@/lib/referrals/referral-code"

const REFERRAL_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

export function persistReferralCodeClient(code: string | null | undefined): string | null {
  const normalized = normalizeReferralCode(code)
  if (!normalized) return null

  try {
    if (typeof document !== "undefined") {
      document.cookie = `${REFERRAL_COOKIE_NAME}=${encodeURIComponent(normalized)}; Max-Age=${REFERRAL_COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax`
    }
  } catch {
    /* ignore */
  }

  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(REFERRAL_STORAGE_KEY, normalized)
    }
  } catch {
    /* ignore */
  }

  return normalized
}

export function readReferralCodeClient(): string | null {
  try {
    if (typeof window !== "undefined") {
      const fromStorage = window.localStorage.getItem(REFERRAL_STORAGE_KEY)
      const normalizedStorage = normalizeReferralCode(fromStorage)
      if (normalizedStorage) return normalizedStorage
    }
  } catch {
    /* ignore */
  }

  try {
    if (typeof document !== "undefined") {
      const match = document.cookie.match(new RegExp(`(?:^|; )${REFERRAL_COOKIE_NAME}=([^;]*)`))
      if (match?.[1]) {
        return normalizeReferralCode(decodeURIComponent(match[1]))
      }
    }
  } catch {
    /* ignore */
  }

  return null
}
