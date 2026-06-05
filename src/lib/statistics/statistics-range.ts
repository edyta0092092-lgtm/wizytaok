import type { StatisticsRange } from "@/lib/statistics/statistics-types"

export function startOfDay(date: Date): Date {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

export function dayKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-")
}

export function parseStatisticsDate(value: string | undefined | null): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function inStatisticsRange(date: Date | null, start: Date, end: Date): boolean {
  if (!date) return false
  const time = date.getTime()
  return time >= start.getTime() && time < end.getTime()
}

export function isSameStatisticsDay(a: Date | null, b: Date): boolean {
  if (!a) return false
  return dayKey(a) === dayKey(b)
}

export function buildRangeBuckets(
  range: StatisticsRange,
  today: Date,
  locale: "pl" | "en",
): Array<{ key: string; label: string; start: Date; end: Date }> {
  const dayFormatter = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "pl-PL", {
    day: "2-digit",
    month: "2-digit",
  })
  const monthFormatter = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "pl-PL", {
    month: "short",
  })
  const end = addDays(startOfDay(today), 1)

  if (range.startsWith("month:")) {
    const [year, month] = range
      .slice("month:".length)
      .split("-")
      .map((value) => Number(value))
    const monthStart = new Date(year, (month || 1) - 1, 1)
    const monthEnd = new Date(year, month || 1, 1)
    const buckets: Array<{ key: string; label: string; start: Date; end: Date }> = []
    let cursor = monthStart
    while (cursor < monthEnd) {
      const bucketEnd = addDays(cursor, 1)
      buckets.push({
        key: dayKey(cursor),
        label: dayFormatter.format(cursor),
        start: cursor,
        end: bucketEnd,
      })
      cursor = bucketEnd
    }
    return buckets
  }

  if (range.startsWith("year:")) {
    const year = Number(range.slice("year:".length))
    const buckets: Array<{ key: string; label: string; start: Date; end: Date }> = []
    for (let month = 0; month < 12; month += 1) {
      const start = new Date(year, month, 1)
      const next = new Date(year, month + 1, 1)
      buckets.push({
        key: monthKey(start),
        label: monthFormatter.format(start),
        start,
        end: next,
      })
    }
    return buckets
  }

  if (range === "12m") {
    const buckets: Array<{ key: string; label: string; start: Date; end: Date }> = []
    for (let i = 11; i >= 0; i -= 1) {
      const start = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const next = new Date(start.getFullYear(), start.getMonth() + 1, 1)
      buckets.push({
        key: monthKey(start),
        label: monthFormatter.format(start),
        start,
        end: next,
      })
    }
    return buckets
  }

  if (range === "90d") {
    const start = startOfDay(addDays(end, -90))
    const buckets: Array<{ key: string; label: string; start: Date; end: Date }> = []
    let cursor = start
    while (cursor < end) {
      const bucketEnd = addDays(cursor, 7)
      const cappedEnd = bucketEnd.getTime() > end.getTime() ? end : bucketEnd
      const lastDay = addDays(cappedEnd, -1)
      buckets.push({
        key: `${dayKey(cursor)}-week`,
        label: `${dayFormatter.format(cursor)}–${dayFormatter.format(lastDay)}`,
        start: cursor,
        end: cappedEnd,
      })
      cursor = cappedEnd
    }
    return buckets
  }

  const days = range === "7d" ? 7 : 30
  const start = addDays(end, -days)
  return Array.from({ length: days }, (_, index) => {
    const bucketStart = addDays(start, index)
    const bucketEnd = addDays(bucketStart, 1)
    return {
      key: dayKey(bucketStart),
      label: dayFormatter.format(bucketStart),
      start: bucketStart,
      end: bucketEnd,
    }
  })
}

export function rangeBounds(
  range: StatisticsRange,
  today: Date,
  locale: "pl" | "en",
): { start: Date; end: Date; dayCount: number } {
  const buckets = buildRangeBuckets(range, today, locale)
  const start = buckets[0]?.start ?? startOfMonth(today)
  const end = buckets[buckets.length - 1]?.end ?? addDays(startOfDay(today), 1)
  const ms = end.getTime() - start.getTime()
  const dayCount = Math.max(1, Math.round(ms / (24 * 60 * 60 * 1000)))
  return { start, end, dayCount }
}
