/**
 * Święta ustawowe wolne od pracy w Polsce (daty kalendarzowe w strefie lokalnej).
 * Wigilia (24.12) jest oznaczeniem informacyjnym w UI kalendarza, nie zmienia logiki isPolishPublicHoliday.
 */

export type PolishHolidayEntry = {
  dateKey: string
  namePl: string
  nameEn: string
}

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

function makeKey(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`
}

/** Algorytm Meeusa dla Wielkanocy (Gregoriańskiej). Zwraca miesiąc 3 lub 4 i dzień. */
function getEasterSundayParts(year: number): { month: number; day: number } {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return { month, day }
}

function addDaysToKey(year: number, month: number, day: number, add: number): string {
  const dt = new Date(year, month - 1, day)
  dt.setDate(dt.getDate() + add)
  return makeKey(dt.getFullYear(), dt.getMonth() + 1, dt.getDate())
}

/**
 * Lista świąt ustawowych (wolne od pracy) dla danego roku.
 * Zielone Świątki = Niedziela Zesłania Ducha Świętego (49 dni po Wielkanocy).
 */
export function getPolishPublicHolidays(year: number): PolishHolidayEntry[] {
  const out: PolishHolidayEntry[] = []

  const fixed: [number, number, string, string][] = [
    [1, 1, "Nowy Rok", "New Year's Day"],
    [1, 6, "Trzech Króli", "Epiphany"],
    [5, 1, "Święto Pracy", "Labour Day"],
    [5, 3, "Święto Konstytucji 3 Maja", "Constitution Day"],
    [8, 15, "Wniebowzięcie Najświętszej Maryi Panny", "Assumption of the Blessed Virgin Mary"],
    [11, 1, "Wszystkich Świętych", "All Saints' Day"],
    [11, 11, "Narodowe Święto Niepodległości", "Independence Day"],
    [12, 25, "Boże Narodzenie", "Christmas Day"],
    [12, 26, "Drugi dzień Bożego Narodzenia", "Second day of Christmas"],
  ]

  for (const [m, d, pl, en] of fixed) {
    out.push({ dateKey: makeKey(year, m, d), namePl: pl, nameEn: en })
  }

  const e = getEasterSundayParts(year)
  const easterKey = makeKey(year, e.month, e.day)
  out.push({ dateKey: easterKey, namePl: "Wielkanoc", nameEn: "Easter Sunday" })
  out.push({
    dateKey: addDaysToKey(year, e.month, e.day, 1),
    namePl: "Poniedziałek Wielkanocny",
    nameEn: "Easter Monday",
  })
  out.push({
    dateKey: addDaysToKey(year, e.month, e.day, 49),
    namePl: "Zielone Świątki",
    nameEn: "Whit Sunday",
  })
  out.push({
    dateKey: addDaysToKey(year, e.month, e.day, 60),
    namePl: "Boże Ciało",
    nameEn: "Corpus Christi",
  })

  out.sort((a, b) => (a.dateKey < b.dateKey ? -1 : a.dateKey > b.dateKey ? 1 : 0))
  return out
}

function dateKeyFromDate(d: Date): string {
  return makeKey(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

export function isPolishPublicHoliday(date: Date): boolean {
  const key = dateKeyFromDate(date)
  const list = getPolishPublicHolidays(date.getFullYear())
  return list.some((h) => h.dateKey === key)
}

/** W UI kalendarza: święta ustawowe albo Wigilia (informacyjnie). */
export function isPolishCalendarHoliday(date: Date): boolean {
  const key = dateKeyFromDate(date)
  if (key.endsWith("-12-24")) return true
  return isPolishPublicHoliday(date)
}

/**
 * Nazwa do wyświetlenia (PL lub EN). Wigilia tylko dla 24.12.
 */
export function getPolishHolidayDisplayName(date: Date, lang: "pl" | "en"): string | null {
  const key = dateKeyFromDate(date)
  const list = getPolishPublicHolidays(date.getFullYear())
  const hit = list.find((h) => h.dateKey === key)
  if (hit) return lang === "en" ? hit.nameEn : hit.namePl
  if (key.endsWith("-12-24")) {
    return lang === "en" ? "Christmas Eve" : "Wigilia Bożego Narodzenia"
  }
  return null
}

/** Nazwa święta po polsku lub null (kompatybilność wsteczna). */
export function getPolishHolidayName(date: Date): string | null {
  return getPolishHolidayDisplayName(date, "pl")
}

/** Święto ustawowe dla klucza YYYY-MM-DD (rok z prefiksu) albo null. */
export function getPolishHolidayEntryForDateKey(dateKey: string): PolishHolidayEntry | null {
  const y = Number(dateKey.slice(0, 4))
  if (!Number.isFinite(y) || y < 1900) return null
  return getPolishPublicHolidays(y).find((h) => h.dateKey === dateKey) ?? null
}
