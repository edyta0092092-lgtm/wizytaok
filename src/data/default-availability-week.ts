import type { AvailabilityDay } from "@/types/domain"

/** Kolejność UI: pn-nd; weekday wg JS: 0=niedziela, 6=sobota. */
const UI_ORDER: readonly number[] = [1, 2, 3, 4, 5, 6, 0]

const LABEL_BY_WEEKDAY: Record<number, AvailabilityDay["label"]> = {
  0: "sunday",
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
}

/**
 * Domyślny tydzień: pn-pt 09:00-17:00, sb-nd zamknięte (bez zapisu do bazy przy samym renderze).
 */
export function getDefaultAvailabilityDays(): AvailabilityDay[] {
  return UI_ORDER.map((weekday) => ({
    id: `wd-${weekday}`,
    weekday,
    label: LABEL_BY_WEEKDAY[weekday] ?? "monday",
    isOpen: weekday >= 1 && weekday <= 5,
    startTime: "09:00",
    endTime: "17:00",
  }))
}
