/** Przybliżony licznik segmentów SMS (GSM-7: 160 znaków na segment). */
export function countSmsUnits(text: string): { length: number; segments: number } {
  const length = text.length
  if (length === 0) return { length: 0, segments: 0 }
  const singleLimit = 160
  const multiLimit = 153
  const segments = length <= singleLimit ? 1 : Math.ceil(length / multiLimit)
  return { length, segments }
}
