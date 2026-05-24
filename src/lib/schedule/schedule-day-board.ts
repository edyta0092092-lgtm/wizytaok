import type { ScheduleDayEntry, ScheduleStaffColumn } from "@/lib/schedule/schedule-day-types"
import {
  SCHEDULE_BOARD_DAY_END_HOUR,
  SCHEDULE_BOARD_DAY_START_HOUR,
  SCHEDULE_BOARD_PX_PER_MINUTE,
} from "@/lib/schedule/schedule-day-types"
import type { AppointmentStatus, StaffMember } from "@/types/domain"

const UNASSIGNED_STAFF_ID = "__unassigned__"

export function parseTimeToMinutes(hm: string): number {
  const m = String(hm).trim().match(/^(\d{1,2}):(\d{2})/)
  if (!m) return SCHEDULE_BOARD_DAY_START_HOUR * 60
  return Number(m[1]) * 60 + Number(m[2])
}

export function formatHm(raw: string): string {
  const m = String(raw).trim().match(/^(\d{1,2}):(\d{2})/)
  if (!m) return "00:00"
  return `${String(Number(m[1])).padStart(2, "0")}:${m[2]}`
}

export function formatHmFromMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
  const min = totalMinutes % 60
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`
}

export function getScheduleBoardRangeMinutes(): { start: number; end: number; span: number } {
  const start = SCHEDULE_BOARD_DAY_START_HOUR * 60
  const end = SCHEDULE_BOARD_DAY_END_HOUR * 60
  return { start, end, span: end - start }
}

export function buildHourLabels(): string[] {
  const labels: string[] = []
  for (let h = SCHEDULE_BOARD_DAY_START_HOUR; h <= SCHEDULE_BOARD_DAY_END_HOUR; h += 1) {
    labels.push(`${String(h).padStart(2, "0")}:00`)
  }
  return labels
}

export function staffInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase()
}

export function accentClassForStatus(status: AppointmentStatus): string {
  switch (status) {
    case "cancelled":
      return "border-border/70 bg-muted/50 text-muted-foreground"
    case "no_show":
      return "border-amber-200/90 bg-amber-50/95 dark:border-amber-800/60 dark:bg-amber-950/35"
    case "completed":
      return "border-emerald-200/90 bg-emerald-50/95 dark:border-emerald-800/60 dark:bg-emerald-950/35"
    default:
      return "border-sky-200/90 bg-sky-50/95 shadow-sm dark:border-sky-800/50 dark:bg-sky-950/30"
  }
}

export function accentStripeForService(serviceName: string): string {
  let hash = 0
  for (let i = 0; i < serviceName.length; i += 1) {
    hash = (hash + serviceName.charCodeAt(i) * (i + 1)) % 360
  }
  const hues = [210, 250, 190, 280, 340, 160]
  const hue = hues[hash % hues.length]
  return `hsl(${hue} 55% 88%)`
}

export function buildStaffColumns(
  entries: ScheduleDayEntry[],
  staffMembers: StaffMember[],
  staffNameById: Map<string, string>,
): ScheduleStaffColumn[] {
  const staffIdsInDay = new Set<string>()
  let hasUnassigned = false
  for (const row of entries) {
    if (row.staff_id?.trim()) staffIdsInDay.add(row.staff_id.trim())
    else hasUnassigned = true
  }

  const orderedStaff = staffMembers.filter((s) => staffIdsInDay.has(s.id))
  for (const id of staffIdsInDay) {
    if (!orderedStaff.some((s) => s.id === id)) {
      orderedStaff.push({
        id,
        name: staffNameById.get(id) ?? "Pracownik",
        isActive: true,
      })
    }
  }

  const columns: ScheduleStaffColumn[] = orderedStaff.map((staff) => ({
    id: staff.id,
    name: staff.name,
    entries: entries.filter((e) => (e.staff_id ?? "") === staff.id),
  }))

  if (hasUnassigned) {
    columns.push({
      id: UNASSIGNED_STAFF_ID,
      name: "Nie przypisano",
      entries: entries.filter((e) => !e.staff_id?.trim()),
    })
  }

  if (columns.length === 0 && entries.length > 0) {
    return [{ id: UNASSIGNED_STAFF_ID, name: "Wizyty", entries }]
  }

  return columns
}

export type ScheduleBlockLayoutTier = "full" | "compact" | "minimal"

/** Minimalna wysokość treści (px) — suma stałych slotów + padding bloku. */
export function blockLayoutContentMinHeightPx(entry: ScheduleDayEntry): number {
  const hasService = Boolean(entry.service_name?.trim())
  if (entry.status === "cancelled") {
    return hasService ? 52 : 36
  }
  return hasService ? 76 : 60
}

export function scheduleBlockLayoutTier(
  heightPx: number,
  opts: { hasService: boolean; isCancelled: boolean },
): ScheduleBlockLayoutTier {
  if (opts.isCancelled) {
    return opts.hasService && heightPx >= 52 ? "full" : "compact"
  }
  if (heightPx >= 88 && opts.hasService) return "full"
  if (heightPx >= 56) return "compact"
  return "minimal"
}

export function scheduleBoardHourHeightPx(): number {
  return Math.round(60 * SCHEDULE_BOARD_PX_PER_MINUTE)
}

export function blockLayout(
  entry: ScheduleDayEntry,
  range: { start: number; end: number; span: number },
): { topPct: number; heightPx: number; clipped: boolean } {
  const startMin = parseTimeToMinutes(entry.appointment_time)
  const duration = Math.max(15, entry.duration_minutes)
  const endMin = startMin + duration
  const visibleStart = Math.max(startMin, range.start)
  const visibleEnd = Math.min(endMin, range.end)
  if (visibleEnd <= range.start || visibleStart >= range.end) {
    return { topPct: 0, heightPx: 48, clipped: true }
  }
  const topPct = ((visibleStart - range.start) / range.span) * 100
  const durationHeightPx = (visibleEnd - visibleStart) * SCHEDULE_BOARD_PX_PER_MINUTE
  const heightPx = Math.max(blockLayoutContentMinHeightPx(entry), Math.round(durationHeightPx))
  return { topPct, heightPx, clipped: startMin < range.start || endMin > range.end }
}
