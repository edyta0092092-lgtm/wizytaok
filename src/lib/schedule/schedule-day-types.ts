import type { AppointmentStatus } from "@/types/domain"

export type ScheduleDayEntry = {
  id: string
  appointment_date: string
  appointment_time: string
  duration_minutes: number
  client_name: string
  service_name: string
  staff_id: string | null
  staff_name: string | null
  status: AppointmentStatus
}

export type ScheduleStaffColumn = {
  id: string
  name: string
  entries: ScheduleDayEntry[]
}

export const SCHEDULE_BOARD_DAY_START_HOUR = 8
export const SCHEDULE_BOARD_DAY_END_HOUR = 20
export const SCHEDULE_BOARD_DEFAULT_DURATION_MINUTES = 30
export const SCHEDULE_BOARD_PX_PER_MINUTE = 1.75
