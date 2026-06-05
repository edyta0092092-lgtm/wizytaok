/** Dozwolone wartości przerwy po usłudze (min) w formularzu usług. */
export const SERVICE_BREAK_MINUTES_OPTIONS = [0, 5, 10, 15, 20, 30, 45, 60] as const

export type ServiceBreakMinutesOption = (typeof SERVICE_BREAK_MINUTES_OPTIONS)[number]

export function formatServiceBreakMinutesOption(minutes: number): string {
  return String(Math.max(0, Math.floor(minutes)))
}

export function parseServiceBreakMinutesFormValue(raw: string): number {
  const n = Math.floor(Number(raw))
  if (!Number.isFinite(n)) return 0
  if ((SERVICE_BREAK_MINUTES_OPTIONS as readonly number[]).includes(n)) return n
  return 0
}
