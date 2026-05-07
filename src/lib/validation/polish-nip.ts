/** Wagi dla pierwszych 9 cyfr polskiego NIP (ustawa / MF). */
const NIP_WEIGHTS = [6, 5, 7, 2, 3, 4, 5, 6, 7] as const

/**
 * Czy napis to poprawny polski NIP: dokładnie 10 cyfr i prawidłowa suma kontrolna.
 */
export function isPolishNip10Valid(compact10: string): boolean {
  if (!/^\d{10}$/.test(compact10)) return false
  const digits = compact10.split("").map((c) => Number(c))
  let sum = 0
  for (let i = 0; i < 9; i++) sum += digits[i]! * NIP_WEIGHTS[i]!
  const checksum = sum % 11
  if (checksum === 10) return false
  return digits[9] === checksum
}
