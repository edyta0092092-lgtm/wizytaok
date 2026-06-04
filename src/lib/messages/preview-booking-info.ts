import { resolveSupabaseBookingRowUuidFromUiId } from "@/lib/bookings/bookings-store"
import {
  getCachedMergedAppointments,
  mergedAppointmentsCacheKey,
} from "@/lib/appointments/merged-appointments-cache"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import type { Appointment } from "@/types/domain"

export type PreviewBookingInfo = {
  id: string
  clientName: string
  serviceName: string
  appointmentDate: string
  appointmentTime: string
  status: string
  createdAt: string | null
  confirmedAt: string | null
  updatedAt: string | null
  lastStatusChangeSource: string | null
  confirmationToken: string | null
  staffName: string | null
}

function isMissingColumnInBookingsQuery(message: string | null | undefined): boolean {
  const m = String(message ?? "")
  return (
    /column .* does not exist/i.test(m) ||
    /could not find the ['"].*['"] column/i.test(m) ||
    /schema cache/i.test(m)
  )
}

export function mapPreviewBookingRow(
  bookingData: Record<string, unknown>,
  bookingId: string,
): PreviewBookingInfo {
  return {
    id: String(bookingData.id ?? bookingId),
    clientName:
      typeof bookingData.client_name === "string" ? bookingData.client_name.trim() : "",
    serviceName:
      typeof bookingData.service_name === "string" ? bookingData.service_name.trim() : "",
    appointmentDate:
      typeof bookingData.appointment_date === "string"
        ? String(bookingData.appointment_date).slice(0, 10)
        : "",
    appointmentTime:
      typeof bookingData.appointment_time === "string"
        ? String(bookingData.appointment_time).slice(0, 5)
        : "",
    status: typeof bookingData.status === "string" ? bookingData.status.trim() : "",
    createdAt: typeof bookingData.created_at === "string" ? bookingData.created_at : null,
    confirmedAt: typeof bookingData.confirmed_at === "string" ? bookingData.confirmed_at : null,
    updatedAt: typeof bookingData.updated_at === "string" ? bookingData.updated_at : null,
    lastStatusChangeSource:
      typeof bookingData.last_status_change_source === "string"
        ? bookingData.last_status_change_source.trim()
        : null,
    confirmationToken:
      typeof bookingData.confirmation_token === "string"
        ? bookingData.confirmation_token.trim()
        : null,
    staffName:
      typeof bookingData.staff_name === "string" ? bookingData.staff_name.trim() : null,
  }
}

function pickNonEmpty(current: string, next: string): string {
  return current.trim() ? current : next.trim()
}

function pickNullable(current: string | null, next: string | null): string | null {
  return current?.trim() ? current : next?.trim() ? next : null
}

export function emptyPreviewBookingInfo(id: string): PreviewBookingInfo {
  return {
    id,
    clientName: "",
    serviceName: "",
    appointmentDate: "",
    appointmentTime: "",
    status: "",
    createdAt: null,
    confirmedAt: null,
    updatedAt: null,
    lastStatusChangeSource: null,
    confirmationToken: null,
    staffName: null,
  }
}

/** Scala kilka źródeł — pierwsze niepuste pole wygrywa. */
export function mergePreviewBookingInfo(
  ...sources: (PreviewBookingInfo | Partial<PreviewBookingInfo> | null | undefined)[]
): PreviewBookingInfo | null {
  const list: PreviewBookingInfo[] = []
  for (let i = 0; i < sources.length; i += 1) {
    const s = sources[i]
    if (!s) continue
    const base = emptyPreviewBookingInfo(s.id?.trim() || `preview-${i}`)
    list.push({ ...base, ...s, id: s.id?.trim() || base.id })
  }
  if (list.length === 0) return null
  const out = { ...list[0] }
  for (const s of list.slice(1)) {
    out.id = out.id || s.id
    out.clientName = pickNonEmpty(out.clientName, s.clientName)
    out.serviceName = pickNonEmpty(out.serviceName, s.serviceName)
    out.appointmentDate = pickNonEmpty(out.appointmentDate, s.appointmentDate)
    out.appointmentTime = pickNonEmpty(out.appointmentTime, s.appointmentTime)
    out.status = pickNonEmpty(out.status, s.status)
    out.createdAt = pickNullable(out.createdAt, s.createdAt)
    out.confirmedAt = pickNullable(out.confirmedAt, s.confirmedAt)
    out.updatedAt = pickNullable(out.updatedAt, s.updatedAt)
    out.lastStatusChangeSource = pickNullable(out.lastStatusChangeSource, s.lastStatusChangeSource)
    out.confirmationToken = pickNullable(out.confirmationToken, s.confirmationToken)
    out.staffName = pickNullable(out.staffName, s.staffName)
  }
  return out
}

export function isPreviewBookingInfoComplete(info: PreviewBookingInfo | null | undefined): boolean {
  if (!info) return false
  return Boolean(
    info.appointmentDate.trim() &&
      info.appointmentTime.trim() &&
      info.serviceName.trim() &&
      info.status.trim(),
  )
}

export function previewBookingFromAppointment(appointment: Appointment): PreviewBookingInfo {
  const startsAt = appointment.startsAt?.trim() ?? ""
  let appointmentDate = ""
  let appointmentTime = ""
  if (startsAt) {
    const d = new Date(startsAt)
    if (!Number.isNaN(d.getTime())) {
      appointmentDate = startsAt.slice(0, 10)
      appointmentTime = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
    }
  }
  return {
    id: appointment.id,
    clientName: appointment.clientName?.trim() ?? "",
    serviceName: appointment.serviceLabel?.trim() ?? "",
    appointmentDate,
    appointmentTime,
    status: appointment.status?.trim() ?? "",
    createdAt: appointment.createdAt ?? null,
    confirmedAt: null,
    updatedAt: appointment.lastStatusChangeAt ?? null,
    lastStatusChangeSource: appointment.lastStatusChangeSource ?? null,
    confirmationToken: null,
    staffName: null,
  }
}

export function findPreviewBookingInAppointments(
  appointments: Appointment[] | null | undefined,
  bookingId: string,
): PreviewBookingInfo | null {
  const targetUuid = resolveSupabaseBookingRowUuidFromUiId(bookingId)
  if (!targetUuid || !appointments?.length) return null
  for (const row of appointments) {
    const rowUuid = resolveSupabaseBookingRowUuidFromUiId(row.id)
    if (rowUuid && rowUuid === targetUuid) {
      return previewBookingFromAppointment(row)
    }
  }
  return null
}

async function loadPreviewBookingFromClient(
  client: SupabaseClient<Database>,
  bookingId: string,
): Promise<PreviewBookingInfo | null> {
  const bookingUuid = resolveSupabaseBookingRowUuidFromUiId(bookingId.trim())
  if (!bookingUuid) return null

  const selects = [
    "id,client_name,service_name,appointment_date,appointment_time,status,created_at,updated_at,last_status_change_source,confirmation_token,staff_name",
    "id,client_name,service_name,appointment_date,appointment_time,status,created_at,confirmation_token,staff_name",
    "id,client_name,service_name,appointment_date,appointment_time,status,created_at,staff_name",
  ]

  for (const select of selects) {
    const { data, error } = await client
      .from("bookings")
      .select(select)
      .eq("id", bookingUuid)
      .maybeSingle()

    if (!error && data) {
      return mapPreviewBookingRow(data as unknown as Record<string, unknown>, bookingUuid)
    }
    if (!isMissingColumnInBookingsQuery(error?.message)) {
      break
    }
  }

  return null
}

async function fetchPreviewBookingFromApi(bookingId: string): Promise<PreviewBookingInfo | null> {
  try {
    const res = await fetch(
      `/api/messages/booking-preview?bookingId=${encodeURIComponent(bookingId.trim())}`,
      { cache: "no-store", credentials: "include" },
    )
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      booking?: PreviewBookingInfo
    }
    if (res.ok && json.ok === true && json.booking) {
      return json.booking
    }
  } catch {
    // fallback only
  }
  return null
}

export type ResolvePreviewBookingInfoArgs = {
  client: SupabaseClient<Database> | null
  businessId: string | null
  bookingId: string
  /** Np. pola z wpisu lokalnego lub wiersza przypomnienia. */
  partial?: Partial<PreviewBookingInfo> | null
  appointments?: Appointment[] | null
}

/**
 * Dane wizyty do sekcji „Powiązana wizyta” — klient Supabase, API (service role), cache listy wizyt.
 */
export async function resolvePreviewBookingInfo(
  args: ResolvePreviewBookingInfoArgs,
): Promise<PreviewBookingInfo | null> {
  const bookingId = args.bookingId.trim()
  if (!bookingId) return null

  const partial: PreviewBookingInfo | null = args.partial
    ? mergePreviewBookingInfo(emptyPreviewBookingInfo(bookingId), args.partial)
    : null

  let fromClient: PreviewBookingInfo | null = null
  if (args.client) {
    fromClient = await loadPreviewBookingFromClient(args.client, bookingId)
  }

  let fromApi: PreviewBookingInfo | null = null
  if (!isPreviewBookingInfoComplete(fromClient)) {
    fromApi = await fetchPreviewBookingFromApi(bookingId)
  }

  const cached =
    args.appointments ??
    (args.businessId ? getCachedMergedAppointments(mergedAppointmentsCacheKey(args.businessId)) : null)
  const fromAppointments = findPreviewBookingInAppointments(cached, bookingId)

  return mergePreviewBookingInfo(partial, fromClient, fromApi, fromAppointments)
}
