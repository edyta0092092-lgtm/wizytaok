export function hmToMinutes(raw: string): number {
  const m = String(raw).trim().match(/^(\d{1,2}):(\d{2})/)
  if (!m) return 0
  return (
    Math.max(0, Math.min(23, Number(m[1]))) * 60 +
    Math.max(0, Math.min(59, Number(m[2])))
  )
}

export function isTimeInsideRange(startHm: string, endHm: string, valueHm: string): boolean {
  const start = hmToMinutes(startHm)
  const end = hmToMinutes(endHm)
  const value = hmToMinutes(valueHm)
  return value >= start && value < end
}
