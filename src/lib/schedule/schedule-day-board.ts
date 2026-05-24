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

/** Etykiety co 30 min (08:00, 08:30, …) dla osi czasu w modalu dnia. */
export function buildHalfHourSlotLabels(): string[] {
  const labels: string[] = []
  const start = SCHEDULE_BOARD_DAY_START_HOUR * 60
  const end = SCHEDULE_BOARD_DAY_END_HOUR * 60
  for (let m = start; m <= end; m += 30) {
    labels.push(formatHmFromMinutes(m))
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
      return "border-border/80 bg-muted/40 text-muted-foreground"
    case "no_show":
      return "border-amber-200/90 bg-amber-50/90 dark:border-amber-800/60 dark:bg-amber-950/40"
    case "completed":
      return "border-violet-200/90 bg-violet-50/90 dark:border-violet-800/60 dark:bg-violet-950/35"
    default:
      return "border-emerald-200/90 bg-emerald-50/90 shadow-sm dark:border-emerald-800/50 dark:bg-emerald-950/35"
  }
}

export function statusBadgeClassForStatus(status: AppointmentStatus): string {
  switch (status) {
    case "cancelled":
      return "border-border/80 bg-muted/60 text-muted-foreground"
    case "no_show":
      return "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
    case "completed":
      return "border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-100"
    default:
      return "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100"
  }
}

export function statusStripeColor(status: AppointmentStatus): string {
  switch (status) {
    case "cancelled":
      return "hsl(var(--muted-foreground) / 0.35)"
    case "no_show":
      return "hsl(38 92% 50%)"
    case "completed":
      return "hsl(270 60% 58%)"
    default:
      return "hsl(142 71% 45%)"
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

export function scheduleBlockLayoutTier(
  heightPx: number,
  opts: { hasService: boolean; isCancelled: boolean },
): ScheduleBlockLayoutTier {
  if (opts.isCancelled) {
    return opts.hasService && heightPx >= 56 ? "full" : "compact"
  }
  if (heightPx >= 64 && opts.hasService) return "full"
  if (heightPx >= 48) return "compact"
  return "minimal"
}

export function scheduleBoardSlotHeightPx(): number {
  return Math.round(30 * SCHEDULE_BOARD_PX_PER_MINUTE)
}

export function scheduleBoardHourHeightPx(): number {
  return scheduleBoardSlotHeightPx() * 2
}

export function blockLayout(
  entry: ScheduleDayEntry,
  range: { start: number; end: number; span: number },
): { topPx: number; heightPx: number; clipped: boolean } {
  const startMin = parseTimeToMinutes(entry.appointment_time)
  const duration = Math.max(15, entry.duration_minutes)
  const endMin = startMin + duration
  const visibleStart = Math.max(startMin, range.start)
  const visibleEnd = Math.min(endMin, range.end)
  if (visibleEnd <= range.start || visibleStart >= range.end) {
    return { topPx: 0, heightPx: scheduleBoardSlotHeightPx(), clipped: true }
  }
  const topPx = Math.round((visibleStart - range.start) * SCHEDULE_BOARD_PX_PER_MINUTE)
  const heightPx = Math.max(1, Math.round((visibleEnd - visibleStart) * SCHEDULE_BOARD_PX_PER_MINUTE))
  return { topPx, heightPx, clipped: startMin < range.start || endMin > range.end }
}
