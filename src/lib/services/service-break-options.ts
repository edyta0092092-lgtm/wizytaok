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

/** Wartość selecta w ustawieniach firmy — brak domyślnej przerwy (null w bazie). */
export const DEFAULT_BREAK_MINUTES_NONE_VALUE = "none"

function snapToBreakMinutesOption(minutes: number): ServiceBreakMinutesOption {
  const n = Math.max(0, Math.floor(minutes))
  if ((SERVICE_BREAK_MINUTES_OPTIONS as readonly number[]).includes(n)) {
    return n as ServiceBreakMinutesOption
  }
  let closest: ServiceBreakMinutesOption = SERVICE_BREAK_MINUTES_OPTIONS[0]
  for (const option of SERVICE_BREAK_MINUTES_OPTIONS) {
    if (Math.abs(option - n) < Math.abs(closest - n)) closest = option
  }
  return closest
}

export function formatDefaultBreakMinutesFormValue(
  minutes: number | null | undefined,
): string {
  if (minutes == null || !Number.isFinite(Number(minutes))) {
    return DEFAULT_BREAK_MINUTES_NONE_VALUE
  }
  return formatServiceBreakMinutesOption(snapToBreakMinutesOption(Number(minutes)))
}

export function parseDefaultBreakMinutesFormValue(raw: string): number | null {
  const value = raw.trim()
  if (!value || value === DEFAULT_BREAK_MINUTES_NONE_VALUE) return null
  const n = Math.floor(Number(value))
  if (!Number.isFinite(n) || n < 0) return null
  return snapToBreakMinutesOption(n)
}

export function normalizeDefaultBreakMinutesFormValue(raw: string | undefined): string {
  if (!raw?.trim() || raw.trim() === DEFAULT_BREAK_MINUTES_NONE_VALUE) {
    return DEFAULT_BREAK_MINUTES_NONE_VALUE
  }
  return formatDefaultBreakMinutesFormValue(Number(raw))
}
