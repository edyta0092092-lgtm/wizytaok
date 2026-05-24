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

/** Siatka: 30 minut = jeden wiersz (jak na mockupie). */
export const SCHEDULE_BOARD_SLOT_MINUTES = 30
export const SCHEDULE_BOARD_SLOT_HEIGHT_PX = 56
export const SCHEDULE_BOARD_PX_PER_MINUTE =
  SCHEDULE_BOARD_SLOT_HEIGHT_PX / SCHEDULE_BOARD_SLOT_MINUTES

/** Odstęp między kartami wizyt (px). */
export const SCHEDULE_BOARD_CARD_GAP_PX = 4

export const SCHEDULE_BOARD_HEADER_HEIGHT_PX = 52
export const SCHEDULE_BOARD_TIME_COLUMN_WIDTH_PX = 68

export const SCHEDULE_BLOCK_MIN_HEIGHT_CONFIRM_PX = 120
