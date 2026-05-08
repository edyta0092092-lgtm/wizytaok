/** Minimalna długość hasła jak w ustawieniach Supabase (często 6+) i wcześniejszej wersji aplikacji. */
const SIGNUP_PASSWORD_MIN_CHARS = 6

export type PasswordPolicyViolation = "too_short"

export function assertPasswordPolicy(password: string): PasswordPolicyViolation | null {
  if (password.length < SIGNUP_PASSWORD_MIN_CHARS) return "too_short"
  return null
}

export function getPasswordPolicyLiveHint(password: string): PasswordPolicyViolation | null {
  if (password.length === 0) return null
  return password.length < SIGNUP_PASSWORD_MIN_CHARS ? "too_short" : null
}

export const PASSWORD_POLICY_I18N: Record<PasswordPolicyViolation, string> = {
  too_short: "auth.passwordPolicyTooShort",
}
