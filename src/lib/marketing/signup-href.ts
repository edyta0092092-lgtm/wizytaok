const TRIAL_SIGNUP_QUERY = "startTrial=true"

const CANONICAL_PRODUCTION_SIGNUP = `https://wizytaok.vercel.app/signup?${TRIAL_SIGNUP_QUERY}`

/**
 * Docelowy adres przycisków „Testuj za darmo przez 14 dni”.
 * Ustaw `NEXT_PUBLIC_SITE_URL` (np. `http://localhost:3000`), żeby lokalnie zostawać na swoim hoście.
 */
export function marketingSignupHref(): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "")
  if (base) return `${base}/signup?${TRIAL_SIGNUP_QUERY}`
  return CANONICAL_PRODUCTION_SIGNUP
}
