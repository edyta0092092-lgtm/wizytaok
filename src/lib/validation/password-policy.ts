/** Minimalna długość i reguły zgodne z komunikatem w formularzu rejestracji. */
const SIGNUP_PASSWORD_MIN_CHARS = 8

function hasUnicodeUppercase(password: string): boolean {
  return /\p{Lu}/u.test(password)
}

/** Znak specjalny: nie litera, nie cyfra, nie biały znak (np. !@#). */
function hasSpecialCharacter(password: string): boolean {
  return /[^\p{L}\p{N}\s]/u.test(password)
}

export type PasswordPolicyViolation = "too_short" | "missing_uppercase" | "missing_special"

export function assertPasswordPolicy(password: string): PasswordPolicyViolation | null {
  if (password.length < SIGNUP_PASSWORD_MIN_CHARS) return "too_short"
  if (!hasUnicodeUppercase(password)) return "missing_uppercase"
  if (!hasSpecialCharacter(password)) return "missing_special"
  return null
}

export function getPasswordPolicyLiveHint(password: string): PasswordPolicyViolation | null {
  if (password.length === 0) return null
  return assertPasswordPolicy(password)
}

export const PASSWORD_POLICY_I18N: Record<PasswordPolicyViolation, string> = {
  too_short: "auth.passwordPolicyTooShort",
  missing_uppercase: "auth.passwordPolicyUppercase",
  missing_special: "auth.passwordPolicySpecial",
}
