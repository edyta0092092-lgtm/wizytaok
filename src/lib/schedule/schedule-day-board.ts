import type { ScheduleDayEntry, ScheduleStaffColumn } from "@/lib/schedule/schedule-day-types"
import {
  SCHEDULE_BOARD_CARD_GAP_PX,
  SCHEDULE_BOARD_DAY_END_HOUR,
  SCHEDULE_BOARD_DAY_START_HOUR,
  SCHEDULE_BOARD_PX_PER_MINUTE,
  SCHEDULE_BOARD_SLOT_HEIGHT_PX,
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

export type ScheduleCardTheme = {
  cardClass: string
  stripeColor: string
  badgeClass: string
  dotClass: string
}

export function scheduleCardTheme(entry: ScheduleDayEntry): ScheduleCardTheme {
  if (entry.status === "cancelled") {
    return {
      cardClass: "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/80",
      stripeColor: "#94a3b8",
      badgeClass:
        "border-slate-200 bg-white text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
      dotClass: "bg-slate-400",
    }
  }
  if (entry.status === "no_show") {
    return {
      cardClass: "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/80",
      stripeColor: "#f59e0b",
      badgeClass:
        "border-amber-200 bg-white text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100",
      dotClass: "bg-amber-500",
    }
  }
  if (entry.status === "completed") {
    return {
      cardClass: "border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/80",
      stripeColor: "#8b5cf6",
      badgeClass:
        "border-violet-200 bg-white text-violet-800 dark:border-violet-700 dark:bg-violet-950 dark:text-violet-100",
      dotClass: "bg-violet-500",
    }
  }

  const hue = serviceAccentHue(entry.service_name)
  if (hue === "orange") {
    return {
      cardClass: "border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/80",
      stripeColor: "#f97316",
      badgeClass:
        "border-orange-200 bg-white text-orange-800 dark:border-orange-700 dark:bg-orange-950 dark:text-orange-100",
      dotClass: "bg-orange-500",
    }
  }
  if (hue === "purple") {
    return {
      cardClass: "border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/80",
      stripeColor: "#8b5cf6",
      badgeClass:
        "border-violet-200 bg-white text-violet-800 dark:border-violet-700 dark:bg-violet-950 dark:text-violet-100",
      dotClass: "bg-violet-500",
    }
  }

  return {
    cardClass: "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/80",
    stripeColor: "#22c55e",
    badgeClass:
      "border-emerald-200 bg-white text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100",
    dotClass: "bg-emerald-500",
  }
}

function serviceAccentHue(serviceName: string): "green" | "orange" | "purple" {
  let hash = 0
  for (let i = 0; i < serviceName.length; i += 1) {
    hash = (hash + serviceName.charCodeAt(i) * (i + 1)) % 360
  }
  const bucket = hash % 3
  if (bucket === 1) return "orange"
  if (bucket === 2) return "purple"
  return "green"
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
    entries: entries
      .filter((e) => (e.staff_id ?? "") === staff.id)
      .sort((a, b) => a.appointment_time.localeCompare(b.appointment_time)),
  }))

  if (hasUnassigned) {
    columns.push({
      id: UNASSIGNED_STAFF_ID,
      name: "Nie przypisano",
      entries: entries
        .filter((e) => !e.staff_id?.trim())
        .sort((a, b) => a.appointment_time.localeCompare(b.appointment_time)),
    })
  }

  if (columns.length === 0 && entries.length > 0) {
    return [
      {
        id: UNASSIGNED_STAFF_ID,
        name: "Wizyty",
        entries: [...entries].sort((a, b) => a.appointment_time.localeCompare(b.appointment_time)),
      },
    ]
  }

  return columns
}

export function scheduleBoardGridHeightPx(): number {
  const { span } = getScheduleBoardRangeMinutes()
  return Math.round(span * SCHEDULE_BOARD_PX_PER_MINUTE)
}

export function scheduleBoardSlotHeightPx(): number {
  return SCHEDULE_BOARD_SLOT_HEIGHT_PX
}

export type ScheduleBlockLayout = {
  topPx: number
  heightPx: number
  clipped: boolean
  laneIndex: number
  laneCount: number
}

function blockGeometry(
  entry: ScheduleDayEntry,
  range: { start: number; end: number },
): { topPx: number; heightPx: number; clipped: boolean } {
  const startMin = parseTimeToMinutes(entry.appointment_time)
  const duration = Math.max(15, entry.duration_minutes)
  const endMin = startMin + duration
  const visibleStart = Math.max(startMin, range.start)
  const visibleEnd = Math.min(endMin, range.end)

  if (visibleEnd <= range.start || visibleStart >= range.end) {
    return {
      topPx: 0,
      heightPx: SCHEDULE_BOARD_SLOT_HEIGHT_PX - SCHEDULE_BOARD_CARD_GAP_PX,
      clipped: true,
    }
  }

  const rawTop = (visibleStart - range.start) * SCHEDULE_BOARD_PX_PER_MINUTE
  const rawHeight = (visibleEnd - visibleStart) * SCHEDULE_BOARD_PX_PER_MINUTE
  const gap = SCHEDULE_BOARD_CARD_GAP_PX

  return {
    topPx: Math.round(rawTop + gap / 2),
    heightPx: Math.max(44, Math.round(rawHeight - gap)),
    clipped: startMin < range.start || endMin > range.end,
  }
}

function intervalsOverlapPx(
  a: { topPx: number; heightPx: number },
  b: { topPx: number; heightPx: number },
): boolean {
  return a.topPx < b.topPx + b.heightPx && b.topPx < a.topPx + a.heightPx
}

export function layoutColumnBlocks(
  entries: ScheduleDayEntry[],
  range: { start: number; end: number; span: number },
): Map<string, ScheduleBlockLayout> {
  const base = entries.map((entry) => ({
    entry,
    ...blockGeometry(entry, range),
  }))
  const result = new Map<string, ScheduleBlockLayout>()

  for (let i = 0; i < base.length; i += 1) {
    const current = base[i]
    const group = base
      .filter((other) => intervalsOverlapPx(current, other))
      .sort((a, b) => a.entry.id.localeCompare(b.entry.id))
    const laneCount = group.length
    const laneIndex = group.findIndex((item) => item.entry.id === current.entry.id)
    result.set(current.entry.id, {
      topPx: current.topPx,
      heightPx: current.heightPx,
      clipped: current.clipped,
      laneIndex: Math.max(0, laneIndex),
      laneCount: Math.max(1, laneCount),
    })
  }

  return result
}
