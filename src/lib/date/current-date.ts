let cachedToday: Date | null = null

/**
 * Jedna referencyjna data "dzisiaj" po stronie klienta.
 * W trakcie sesji aplikacji zwracamy ten sam dzień, aby uniknąć rozjazdów widoków.
 */
export function getAppToday(): Date {
  if (cachedToday === null) {
    cachedToday = new Date()
  }
  return new Date(cachedToday.getTime())
}

export function isSameAppDay(date: Date | string, ref: Date = getAppToday()): boolean {
  const value = typeof date === "string" ? new Date(date) : date
  return (
    value.getFullYear() === ref.getFullYear() &&
    value.getMonth() === ref.getMonth() &&
    value.getDate() === ref.getDate()
  )
}

