import type { SupabaseClient } from "@supabase/supabase-js"

import { isSupabaseConfigured } from "@/lib/supabase/client"
import type { Database } from "@/types/database"

export type SlotsAvailabilityClient = SupabaseClient<Database>

/** Statusy rezerwacji blokujące slot (appointment_date + appointment_time). */
const BLOCKING_STATUSES = [
  "booked",
  "pending",
  "confirmed",
] as const

export type BlockingBookingStatus = (typeof BLOCKING_STATUSES)[number]

export type BookedAppointmentSlot = {
  id?: string
  appointment_date: string
  appointment_time: string
  status?: string
  staff_id?: string | null
  /** Czas trwania zapisany przy rezerwacji — do wykrywania nakładających się wizyt. */
  service_duration_minutes?: number
}

export function getBlockingStatuses(): readonly BlockingBookingStatus[] {
  return BLOCKING_STATUSES
}

export function isBookingBlockingSlot(status: string | null | undefined): boolean {
  if (!status) return false
  return (BLOCKING_STATUSES as readonly string[]).includes(status)
}

/** Normalizacja godziny do HH:MM (zgodnie z UI slotów i time z DB). */
export function normalizeSlotTimeLabel(raw: string): string {
  const s = String(raw).trim()
  const m = s.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return "00:00"
  return `${String(Number(m[1])).padStart(2, "0")}:${m[2]}`
}

/** Minuty od północy dla godziny z UI lub z kolumny `time` / `appointment_time`. */
export function appointmentStartToMinutesSinceMidnight(raw: string): number {
  const s = String(raw).trim()
  const m = s.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return 0
  const h = Math.min(23, Math.max(0, Number(m[1])))
  const min = Math.min(59, Math.max(0, Number(m[2])))
  return h * 60 + min
}

function intervalsOverlapDay(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): boolean {
  return aStart < bEnd && aEnd > bStart
}

/**
 * Czy dla wskazanego pracownika istnieje **inna** wizyta (status blokujący) nachodząca czasowo
 * na przedział [start, start + duration), z wyłączeniem `excludeBookingId`.
 */
export async function hasStaffSchedulingIntervalOverlap(
  client: SlotsAvailabilityClient,
  businessId: string,
  appointmentDate: string,
  appointmentStartTime: string,
  durationMinutes: number,
  staffId: string,
  options?: { excludeBookingId?: string | null }
): Promise<boolean> {
  const sid = staffId.trim()
  if (!sid) return false
  const day = appointmentDate.trim().slice(0, 10)
  const dur = Math.max(1, Math.floor(durationMinutes || 0))
  const newStart = appointmentStartToMinutesSinceMidnight(appointmentStartTime)
  const newEnd = newStart + dur
  const rows = await getBookedSlotsForBusiness(client, businessId, day, day)
  const ex = options?.excludeBookingId?.trim()
  for (const r of rows) {
    if (!isBookingBlockingSlot(r.status)) continue
    if (ex && r.id === ex) continue
    const otherStaff =
      typeof r.staff_id === "string" && r.staff_id.trim().length > 0 ? r.staff_id.trim() : null
    if (otherStaff !== sid) continue
    const oDur = Math.max(
      1,
      Math.floor(Number(r.service_duration_minutes ?? 60) || 60)
    )
    const oStart = appointmentStartToMinutesSinceMidnight(r.appointment_time)
    const oEnd = oStart + oDur
    if (intervalsOverlapDay(newStart, newEnd, oStart, oEnd)) return true
  }
  return false
}

export function blockedSlotKey(dateKey: string, timeLabel: string): string {
  return `${dateKey.trim()}|${normalizeSlotTimeLabel(timeLabel)}`
}

export function filterAvailableSlots(
  slots: string[],
  dateKey: string,
  booked: readonly BookedAppointmentSlot[] | ReadonlySet<string> | null | undefined
): string[] {
  if (!booked) return slots
  let blockedKeys: ReadonlySet<string>
  if (Array.isArray(booked)) {
    if (booked.length === 0) return slots
    blockedKeys = new Set(
      booked
        .filter((b) => isBookingBlockingSlot(b.status))
        .map((b) => blockedSlotKey(String(b.appointment_date).slice(0, 10), b.appointment_time))
    )
  } else {
    blockedKeys = booked as ReadonlySet<string>
  }
  return slots.filter((slot) => !blockedKeys.has(blockedSlotKey(dateKey, slot)))
}

export function isSlotInBlockedSet(
  dateKey: string,
  timeLabel: string,
  blocked: ReadonlySet<string> | null | undefined
): boolean {
  if (!blocked || blocked.size === 0) return false
  return blocked.has(blockedSlotKey(dateKey, timeLabel))
}

export function toBlockedSlotKeySet(rows: readonly BookedAppointmentSlot[]): Set<string> {
  const set = new Set<string>()
  for (const b of rows) {
    if (!isBookingBlockingSlot(b.status)) continue
    set.add(blockedSlotKey(String(b.appointment_date).slice(0, 10), b.appointment_time))
  }
  return set
}

function appendOverlappingBlockedKeys(
  out: Set<string>,
  booking: BookedAppointmentSlot,
  selectedDurationMinutes: number
) {
  const candidateDur = Math.max(1, Math.floor(selectedDurationMinutes || 0))
  if (!candidateDur) return
  const day = String(booking.appointment_date).slice(0, 10)
  const existingStart = appointmentStartToMinutesSinceMidnight(booking.appointment_time)
  const existingDur = Math.max(
    1,
    Math.floor(
      Number(
        booking.service_duration_minutes != null
          ? booking.service_duration_minutes
          : Math.max(60, candidateDur)
      ) || Math.max(60, candidateDur)
    )
  )
  const existingEnd = existingStart + existingDur
  for (let candidateStart = 0; candidateStart < 24 * 60; candidateStart += 15) {
    const candidateEnd = candidateStart + candidateDur
    if (intervalsOverlapDay(candidateStart, candidateEnd, existingStart, existingEnd)) {
      out.add(blockedSlotKey(day, `${String(Math.floor(candidateStart / 60)).padStart(2, "0")}:${String(candidateStart % 60).padStart(2, "0")}`))
    }
  }
}

export function toBlockedSlotKeySetForStaff(
  rows: readonly BookedAppointmentSlot[],
  staffId: string | null,
  selectedDurationMinutes?: number
): Set<string> {
  const set = new Set<string>()
  const useOverlapModel = Number.isFinite(Number(selectedDurationMinutes)) && Number(selectedDurationMinutes) > 0
  for (const b of rows) {
    if (!isBookingBlockingSlot(b.status)) continue
    if (!staffId) {
      // In public booking view, already reserved hours should not be selectable.
      // For "any staff" mode we therefore block all booked starts.
      if (useOverlapModel) {
        appendOverlappingBlockedKeys(set, b, Number(selectedDurationMinutes))
      } else {
        set.add(blockedSlotKey(String(b.appointment_date).slice(0, 10), b.appointment_time))
      }
      continue
    }
    const rowStaffId =
      typeof b.staff_id === "string" && b.staff_id.trim().length > 0 ? b.staff_id.trim() : null
    // For a concrete selected staff member:
    // - same staff_id blocks
    // - missing staff_id (legacy schema / unknown assignment) also blocks conservatively,
    //   so occupied hours are never exposed as available.
    if (rowStaffId !== null && rowStaffId !== staffId) continue
    if (useOverlapModel) {
      appendOverlappingBlockedKeys(set, b, Number(selectedDurationMinutes))
    } else {
      set.add(blockedSlotKey(String(b.appointment_date).slice(0, 10), b.appointment_time))
    }
  }
  return set
}

/**
 * Odczyt zajętych slotów (appointment_date + appointment_time) dla firmy zalogowanej (RLS).
 */
export async function getBookedSlotsForBusiness(
  client: SlotsAvailabilityClient,
  businessId: string,
  dateFrom: string,
  dateTo: string
): Promise<BookedAppointmentSlot[]> {
  if (!isSupabaseConfigured() || !client) return []
  const from = dateFrom.trim().slice(0, 10)
  const to = dateTo.trim().slice(0, 10)
  const { data, error } = await client
    .from("bookings")
    .select("id, appointment_date, appointment_time, status, staff_id, service_duration_minutes")
    .eq("business_id", businessId)
    .gte("appointment_date", from)
    .lte("appointment_date", to)
    .in("status", [...BLOCKING_STATUSES])
  if (error || !data) return []
  return data.map((row) => ({
    id: row.id,
    appointment_date: String(row.appointment_date).slice(0, 10),
    appointment_time: String(row.appointment_time),
    status: row.status as string,
    staff_id:
      typeof row.staff_id === "string" && row.staff_id.trim().length > 0
        ? row.staff_id.trim()
        : null,
    service_duration_minutes:
      row.service_duration_minutes != null
        ? Math.max(1, Math.floor(Number(row.service_duration_minutes) || 0))
        : undefined,
  }))
}

export type AppointmentSlotConflictOptions = {
  excludeBookingId?: string | null
  /**
   * undefined: legacy - any blocking booking at this slot blocks.
   * null: same as create_online_booking with null staff_id - only bookings without staff_id.
   * string: conflicts only when another booking has the same staff_id.
   */
  staffScope?: string | null
}

function isBlockingRowForSlot(
  row: BookedAppointmentSlot,
  slotKey: string,
  opts: AppointmentSlotConflictOptions | undefined
): boolean {
  if (!isBookingBlockingSlot(row.status)) return false
  if (blockedSlotKey(row.appointment_date, row.appointment_time) !== slotKey) return false
  if (opts?.excludeBookingId && row.id === opts.excludeBookingId) return false
  const scope = opts?.staffScope
  if (scope === undefined) return true
  const sid =
    typeof row.staff_id === "string" && row.staff_id.trim().length > 0 ? row.staff_id.trim() : null
  if (scope === null) return sid === null
  return sid === scope
}

/**
 * Czy inna rezerwacja (z wyłączeniem excludeBookingId) zajmuje już ten slot appointmentu.
 */
export async function isAppointmentSlotTakenByOtherBooking(
  client: SlotsAvailabilityClient,
  businessId: string,
  appointmentDate: string,
  appointmentTime: string,
  excludeOrOptions?: string | null | AppointmentSlotConflictOptions
): Promise<boolean> {
  const opts: AppointmentSlotConflictOptions | undefined =
    typeof excludeOrOptions === "string" || excludeOrOptions === null
      ? { excludeBookingId: excludeOrOptions ?? undefined, staffScope: undefined }
      : excludeOrOptions
  const day = appointmentDate.trim().slice(0, 10)
  const rows = await getBookedSlotsForBusiness(client, businessId, day, day)
  const key = blockedSlotKey(day, appointmentTime)
  for (const r of rows) {
    if (isBlockingRowForSlot(r, key, opts)) return true
  }
  return false
}

export async function isSlotAvailable(
  client: SlotsAvailabilityClient,
  businessId: string,
  date: string,
  time: string,
  excludeBookingId?: string | null
): Promise<boolean> {
  return !(await isAppointmentSlotTakenByOtherBooking(client, businessId, date, time, excludeBookingId))
}

/**
 * Publiczny odczyt zajętych slotów po slug (RPC security definer).
 */
export async function fetchBookedSlotsForPublicSlug(
  client: SlotsAvailabilityClient,
  slug: string,
  dateFrom: string,
  dateTo: string
): Promise<BookedAppointmentSlot[]> {
  if (!isSupabaseConfigured() || !client) return []
  const { data, error } = await client.rpc("get_booked_slots_for_public_booking", {
    p_slug: slug.trim().toLowerCase(),
    p_date_from: dateFrom.trim().slice(0, 10),
    p_date_to: dateTo.trim().slice(0, 10),
  })
  if (error || data == null) return []
  if (Array.isArray(data)) {
    const rows = data as unknown[]
    return rows
      .filter((x): x is Record<string, unknown> => x != null && typeof x === "object" && !Array.isArray(x))
      .map((o) => ({
        appointment_date: String(o.appointment_date ?? "").slice(0, 10),
        appointment_time: String(o.appointment_time ?? ""),
        status: typeof o.status === "string" ? o.status : undefined,
        service_duration_minutes:
          o.service_duration_minutes != null
            ? Math.max(1, Math.floor(Number(o.service_duration_minutes) || 0))
            : undefined,
        staff_id:
          typeof o.staff_id === "string" && o.staff_id.trim().length > 0
            ? o.staff_id
            : null,
      }))
      .filter((r) => r.appointment_date.length > 0)
  }
  if (typeof data === "object") {
    const o = data as Record<string, unknown>
    return [
      {
        appointment_date: String(o.appointment_date ?? "").slice(0, 10),
        appointment_time: String(o.appointment_time ?? ""),
        status: typeof o.status === "string" ? o.status : undefined,
        service_duration_minutes:
          o.service_duration_minutes != null
            ? Math.max(1, Math.floor(Number(o.service_duration_minutes) || 0))
            : undefined,
        staff_id:
          typeof o.staff_id === "string" && o.staff_id.trim().length > 0
            ? o.staff_id
            : null,
      },
    ].filter((r) => r.appointment_date.length > 0)
  }
  return []
}

export async function isSlotAvailableForPublicSlug(
  client: SlotsAvailabilityClient,
  slug: string,
  appointmentDate: string,
  appointmentTime: string
): Promise<boolean> {
  const day = appointmentDate.trim().slice(0, 10)
  const rows = await fetchBookedSlotsForPublicSlug(client, slug, day, day)
  return !isSlotInBlockedSet(day, appointmentTime, toBlockedSlotKeySet(rows))
}
