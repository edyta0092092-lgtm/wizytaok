import type { SupabaseClient } from "@supabase/supabase-js"

import {
  hasStaffSchedulingIntervalOverlap,
  isAppointmentSlotTakenByOtherBooking,
  isSlotAvailableForPublicSlug,
} from "@/lib/bookings/slot-availability"
import { DEMO_BOOKING_SLUG } from "@/lib/business/slug"
import { findOrCreateClient } from "@/lib/clients/find-or-create-client"
import { combineLocalDateTimeToUtcIso } from "@/lib/bookings/public-bookings"
import { getCurrentBusinessProfileIdForClient } from "@/lib/services/services-store"
import { isSupabaseConfigured } from "@/lib/supabase/client"
import { normalizeBookingSource } from "@/lib/bookings/booking-source"
import type { Database, Json, Tables, TablesInsert, TablesUpdate } from "@/types/database"
import type { Appointment, AppointmentStatus } from "@/types/domain"
import type { PublicBooking, PublicBookingStatus } from "@/lib/bookings/public-bookings"

export const SB_BOOKING_PREFIX = "sb-"

export type BookingsStoreClient = SupabaseClient<Database>

export function unwrapSupabaseBookingAppointmentId(uiId: string): string | null {
  return resolveSupabaseBookingRowUuidFromUiId(uiId)
}

const BOOKINGS_ROW_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * UUID wiersza `public.bookings` z id używanego na liście wizyt (`sb-{uuid}` lub sporadycznie sam uuid).
 */
export function resolveSupabaseBookingRowUuidFromUiId(uiId: string): string | null {
  const t = typeof uiId === "string" ? uiId.trim() : ""
  if (!t) return null
  if (t.startsWith(SB_BOOKING_PREFIX)) {
    const u = t.slice(SB_BOOKING_PREFIX.length).trim()
    return u.length > 0 ? u.toLowerCase() : null
  }
  return BOOKINGS_ROW_UUID_RE.test(t) ? t.toLowerCase() : null
}

function dispatchBookingsUpdated() {
  if (typeof window === "undefined") return
  void import("@/lib/appointments/merged-appointments-cache").then((m) => {
    m.invalidateMergedAppointmentsCache()
  })
  window.dispatchEvent(new Event("pw-bookings"))
}

function isSupabaseBookingsPath(client: BookingsStoreClient | null, businessId: string | null): boolean {
  return Boolean(client && businessId && isSupabaseConfigured())
}

function formatTimeFromDb(value: string): string {
  const s = String(value).trim()
  const m = s.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return "09:00"
  return `${String(Number(m[1])).padStart(2, "0")}:${m[2]}`
}

function toPgTimeHm(t: string): string {
  const parts = t.trim().split(":")
  const h = Math.min(23, Math.max(0, Number(parts[0] ?? 0)))
  const m = Math.min(59, Math.max(0, Number(parts[1] ?? 0)))
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`
}

function mapDbStatusToAppointmentStatus(s: string): AppointmentStatus {
  const status = String(s ?? "").trim().toLowerCase()
  switch (status) {
    case "pending":
      return "pending"
    case "confirmed":
      return "confirmed"
    case "cancelled":
    case "canceled":
    case "anulowana":
    case "anulowane":
      return "cancelled"
    case "no_show":
      return "no_show"
    case "completed":
      return "completed"
    case "reschedule_requested":
    case "business_reschedule_proposed":
    case "booked":
    default:
      return "booked"
  }
}

function mapAppointmentStatusToDb(s: AppointmentStatus): string {
  return s
}

export function mapBookingRowToPublicBooking(row: Tables<"bookings">, businessSlug: string): PublicBooking {
  const dateStr = String(row.appointment_date).slice(0, 10)
  const timeStr = formatTimeFromDb(row.appointment_time)
  const rawStatus = String(row.status ?? "confirmed")
  const st: PublicBookingStatus =
    rawStatus === "booked" || rawStatus === "pending" ? "confirmed" : (rawStatus as PublicBookingStatus)
  return {
    id: row.id,
    confirmationToken: row.confirmation_token,
    businessSlug,
    serviceId: row.service_id ?? undefined,
    serviceName: row.service_name,
    serviceDurationMinutes: Math.max(0, Math.floor(Number(row.service_duration_minutes))),
    servicePrice: Math.max(0, Number(row.service_price)),
    date: dateStr,
    time: timeStr,
    customerName: row.client_name,
    customerPhone: row.client_phone,
    customerEmail: row.client_email ?? undefined,
    note: row.customer_note ?? undefined,
    customerNote: row.customer_note ?? undefined,
    rescheduleMessage: row.reschedule_message ?? undefined,
    proposedDate: row.proposed_date ? String(row.proposed_date).slice(0, 10) : undefined,
    proposedTime: row.proposed_time ? formatTimeFromDb(row.proposed_time) : undefined,
    proposedServiceName: row.proposed_service_name ?? undefined,
    proposedServiceDuration:
      row.proposed_service_duration_minutes != null
        ? Math.max(0, Math.floor(Number(row.proposed_service_duration_minutes)))
        : undefined,
    proposedServicePrice:
      row.proposed_service_price != null ? Math.max(0, Number(row.proposed_service_price)) : undefined,
    proposedStaffId:
      typeof row.proposed_staff_id === "string" && row.proposed_staff_id.trim().length > 0
        ? row.proposed_staff_id.trim()
        : undefined,
    proposedStaffName:
      typeof row.proposed_staff_name === "string" && row.proposed_staff_name.trim().length > 0
        ? row.proposed_staff_name.trim()
        : undefined,
    businessNote: row.business_note ?? undefined,
    internalNote: row.internal_note ?? undefined,
    statusBeforeRequest:
      row.status_before_request === "booked" || row.status_before_request === "confirmed"
        ? row.status_before_request
        : undefined,
    status: st,
    source: normalizeBookingSource(row.source),
    createdAt: row.created_at,
    reminderDueAt: row.reminder_due_at ?? undefined,
    reminderSentAt: row.reminder_sent_at ?? undefined,
    reminderStatus: row.reminder_status ?? undefined,
    reminderError: row.reminder_error ?? undefined,
    firstReminderDueAt: row.first_reminder_due_at ?? undefined,
    firstReminderSentAt: row.first_reminder_sent_at ?? undefined,
    firstReminderStatus: row.first_reminder_status ?? undefined,
    secondReminderDueAt: row.second_reminder_due_at ?? undefined,
    secondReminderSentAt: row.second_reminder_sent_at ?? undefined,
    secondReminderStatus: row.second_reminder_status ?? undefined,
    secondReminderError: row.second_reminder_error ?? undefined,
    lastUpdatedBy:
      row.last_updated_by === "customer" ||
      row.last_updated_by === "business" ||
      row.last_updated_by === "system"
        ? row.last_updated_by
        : undefined,
    updatedAt: row.updated_at,
    lastStatusChangeAt: row.updated_at,
    lastStatusChangeSource:
      row.last_status_change_source === "manual" ||
      row.last_status_change_source === "confirm" ||
      row.last_status_change_source === "cancel" ||
      row.last_status_change_source === "system" ||
      row.last_status_change_source === "auto_reminder_24h" ||
      row.last_status_change_source === "automatic_24h_reminder"
        ? row.last_status_change_source
        : undefined,
    previousDate: row.previous_date ? String(row.previous_date).slice(0, 10) : undefined,
    previousTime: row.previous_time ? formatTimeFromDb(row.previous_time) : undefined,
    previousServiceName: row.previous_service_name ?? undefined,
    previousServiceDuration:
      row.previous_service_duration_minutes != null
        ? Math.max(0, Math.floor(Number(row.previous_service_duration_minutes)))
        : undefined,
    previousServicePrice:
      row.previous_service_price != null ? Math.max(0, Number(row.previous_service_price)) : undefined,
    lastChangeType:
      row.last_change_type === "business_proposal_accepted" ||
      row.last_change_type === "customer_request_accepted" ||
      row.last_change_type === "customer_service_request_accepted" ||
      row.last_change_type === "customer_request_rejected" ||
      row.last_change_type === "reminder_24h_sent"
        ? row.last_change_type
        : undefined,
    acceptedProposalAt: row.accepted_proposal_at ?? undefined,
    businessProposalKind:
      row.business_proposal_kind === "time" ||
      row.business_proposal_kind === "service" ||
      row.business_proposal_kind === "both"
        ? row.business_proposal_kind
        : undefined,
    staffId: row.staff_id ?? undefined,
    staffName: row.staff_name ?? undefined,
    cancelledAt: row.cancelled_at ?? undefined,
    cancelledBy: row.cancelled_by ?? undefined,
    cancellationNote: row.cancellation_note ?? undefined,
  }
}

export function mapBookingRowToAppointment(row: Tables<"bookings">, businessSlug: string): Appointment {
  const pb = mapBookingRowToPublicBooking(row, businessSlug)
  return {
    id: `${SB_BOOKING_PREFIX}${row.id}`,
    clientId: row.client_id ?? undefined,
    clientName: pb.customerName,
    phone: pb.customerPhone,
    email: pb.customerEmail,
    serviceLabel: pb.serviceName,
    startsAt: combineLocalDateTimeToUtcIso(pb.date, pb.time),
    createdAt: pb.createdAt ?? row.created_at ?? undefined,
    status: mapDbStatusToAppointmentStatus(row.status),
    source: normalizeBookingSource(row.source),
    notes: [pb.note, pb.customerNote].filter((x) => x && x.trim()).join("\n\n") || undefined,
    rescheduleMessage: pb.rescheduleMessage,
    proposedDate: pb.proposedDate,
    proposedTime: pb.proposedTime,
    proposedServiceName: pb.proposedServiceName,
    proposedServiceDuration: pb.proposedServiceDuration,
    proposedServicePrice: pb.proposedServicePrice,
    proposedStaffId: pb.proposedStaffId,
    proposedStaffName: pb.proposedStaffName,
    customerNote: pb.customerNote,
    businessNote: pb.businessNote,
    internalNote: pb.internalNote,
    lastUpdatedBy: pb.lastUpdatedBy,
    lastStatusChangeAt: pb.lastStatusChangeAt,
    lastStatusChangeSource: pb.lastStatusChangeSource,
    statusBeforeRequest: pb.statusBeforeRequest,
    previousDate: pb.previousDate,
    previousTime: pb.previousTime,
    previousServiceName: pb.previousServiceName,
    previousServiceDuration: pb.previousServiceDuration,
    previousServicePrice: pb.previousServicePrice,
    lastChangeType: pb.lastChangeType,
    acceptedProposalAt: pb.acceptedProposalAt,
    businessProposalKind: pb.businessProposalKind,
    noShowRisk: "none",
    confirmationToken: pb.confirmationToken,
    businessSlug: pb.businessSlug,
    serviceId: pb.serviceId,
    staffId: pb.staffId,
    staffName: pb.staffName,
    reminderDueAt: pb.reminderDueAt,
    reminderSentAt: pb.reminderSentAt,
    reminderStatus: pb.reminderStatus,
    reminderError: pb.reminderError,
    firstReminderDueAt: pb.firstReminderDueAt,
    firstReminderSentAt: pb.firstReminderSentAt,
    firstReminderStatus: pb.firstReminderStatus,
    secondReminderDueAt: pb.secondReminderDueAt,
    secondReminderSentAt: pb.secondReminderSentAt,
    secondReminderStatus: pb.secondReminderStatus,
    secondReminderError: pb.secondReminderError,
  }
}

export function publicBookingPatchToDbUpdate(patch: Partial<PublicBooking>): TablesUpdate<"bookings"> {
  const out: TablesUpdate<"bookings"> = {}
  if (patch.customerName !== undefined) out.client_name = patch.customerName.trim()
  if (patch.customerPhone !== undefined) out.client_phone = patch.customerPhone.trim()
  if (patch.customerEmail !== undefined) out.client_email = patch.customerEmail?.trim() || null
  if (patch.serviceName !== undefined) out.service_name = patch.serviceName.trim()
  if (patch.serviceDurationMinutes !== undefined) {
    out.service_duration_minutes = Math.max(0, Math.floor(patch.serviceDurationMinutes))
  }
  if (patch.servicePrice !== undefined) out.service_price = Math.max(0, patch.servicePrice)
  if (patch.date !== undefined) out.appointment_date = patch.date.trim()
  if (patch.time !== undefined) out.appointment_time = toPgTimeHm(patch.time)
  if (patch.status !== undefined) out.status = patch.status
  if (patch.customerNote !== undefined) out.customer_note = patch.customerNote?.trim() || null
  if (patch.businessNote !== undefined) out.business_note = patch.businessNote?.trim() || null
  if (patch.internalNote !== undefined) out.internal_note = patch.internalNote?.trim() || null
  if (patch.rescheduleMessage !== undefined) out.reschedule_message = patch.rescheduleMessage?.trim() || null
  if (patch.proposedDate !== undefined) {
    out.proposed_date = patch.proposedDate && patch.proposedDate.trim() ? patch.proposedDate.trim() : null
  }
  if (patch.proposedTime !== undefined) {
    out.proposed_time =
      patch.proposedTime && patch.proposedTime.trim() ? toPgTimeHm(patch.proposedTime.trim()) : null
  }
  if (patch.proposedServiceName !== undefined) {
    out.proposed_service_name = patch.proposedServiceName?.trim() || null
  }
  if (patch.proposedServiceDuration !== undefined) {
    out.proposed_service_duration_minutes =
      patch.proposedServiceDuration != null ? Math.max(0, Math.floor(patch.proposedServiceDuration)) : null
  }
  if (patch.proposedServicePrice !== undefined) {
    out.proposed_service_price =
      patch.proposedServicePrice != null ? Math.max(0, patch.proposedServicePrice) : null
  }
  if (patch.proposedStaffId !== undefined) {
    out.proposed_staff_id =
      typeof patch.proposedStaffId === "string" && patch.proposedStaffId.trim().length > 0
        ? patch.proposedStaffId.trim()
        : null
  }
  if (patch.proposedStaffName !== undefined) {
    out.proposed_staff_name = patch.proposedStaffName?.trim() ? patch.proposedStaffName.trim() : null
  }
  if (patch.previousDate !== undefined) {
    out.previous_date = patch.previousDate && patch.previousDate.trim() ? patch.previousDate.trim() : null
  }
  if (patch.previousTime !== undefined) {
    out.previous_time =
      patch.previousTime && patch.previousTime.trim() ? toPgTimeHm(patch.previousTime.trim()) : null
  }
  if (patch.previousServiceName !== undefined) {
    out.previous_service_name = patch.previousServiceName?.trim() || null
  }
  if (patch.previousServiceDuration !== undefined) {
    out.previous_service_duration_minutes =
      patch.previousServiceDuration != null ? Math.max(0, Math.floor(patch.previousServiceDuration)) : null
  }
  if (patch.previousServicePrice !== undefined) {
    out.previous_service_price =
      patch.previousServicePrice != null ? Math.max(0, patch.previousServicePrice) : null
  }
  if (patch.statusBeforeRequest !== undefined) {
    out.status_before_request = patch.statusBeforeRequest ?? null
  }
  if (patch.lastUpdatedBy !== undefined) out.last_updated_by = patch.lastUpdatedBy ?? null
  if (patch.lastStatusChangeSource !== undefined) {
    out.last_status_change_source = patch.lastStatusChangeSource ?? null
  }
  if (patch.lastChangeType !== undefined) out.last_change_type = patch.lastChangeType ?? null
  if (patch.acceptedProposalAt !== undefined) out.accepted_proposal_at = patch.acceptedProposalAt ?? null
  if (patch.businessProposalKind !== undefined) out.business_proposal_kind = patch.businessProposalKind ?? null
  if (patch.staffId !== undefined) {
    out.staff_id =
      typeof patch.staffId === "string" && patch.staffId.trim().length > 0 ? patch.staffId.trim() : null
  }
  if (patch.staffName !== undefined) {
    out.staff_name = patch.staffName?.trim() ? patch.staffName.trim() : null
  }
  if (patch.cancelledAt !== undefined) {
    out.cancelled_at = patch.cancelledAt?.trim() ? patch.cancelledAt.trim() : null
  }
  if (patch.cancelledBy !== undefined) {
    out.cancelled_by = patch.cancelledBy?.trim() ? patch.cancelledBy.trim() : null
  }
  if (patch.cancellationNote !== undefined) {
    out.cancellation_note = patch.cancellationNote?.trim() ? patch.cancellationNote.trim() : null
  }
  if (patch.updatedAt !== undefined) {
    /* updated_at trigger handles */
  }
  return out
}

const businessSlugById = new Map<string, string>()

async function resolveBusinessSlug(
  client: BookingsStoreClient,
  businessId: string,
): Promise<string> {
  const cached = businessSlugById.get(businessId)
  if (cached !== undefined) return cached
  const { data: bp } = await client.from("business_profiles").select("slug").eq("id", businessId).maybeSingle()
  const slug = bp?.slug?.trim() ?? ""
  businessSlugById.set(businessId, slug)
  return slug
}

export async function getBookingsForBusiness(
  client: BookingsStoreClient | null,
  businessId: string | null,
  businessSlug: string
): Promise<Appointment[]> {
  if (!isSupabaseBookingsPath(client, businessId)) return []
  const { data, error } = await client!
    .from("bookings")
    .select("*")
    .eq("business_id", businessId!)
    .order("appointment_date", { ascending: true })
    .order("appointment_time", { ascending: true })
  if (error || !data) return []
  return data.map((row) => mapBookingRowToAppointment(row as Tables<"bookings">, businessSlug))
}

export async function getBookingsForBusinessBetweenDates(
  client: BookingsStoreClient | null,
  businessId: string,
  businessSlug: string,
  fromDate: string,
  toDate: string,
): Promise<Appointment[]> {
  if (!isSupabaseBookingsPath(client, businessId)) return []
  const { data, error } = await client!
    .from("bookings")
    .select("*")
    .eq("business_id", businessId)
    .gte("appointment_date", fromDate)
    .lte("appointment_date", toDate)
    .order("appointment_date", { ascending: true })
    .order("appointment_time", { ascending: true })
  if (error || !data) return []
  return data.map((row) => mapBookingRowToAppointment(row as Tables<"bookings">, businessSlug))
}

export async function getBookingsForBusinessMonth(
  client: BookingsStoreClient | null,
  businessId: string,
  year: number,
  month: number,
): Promise<Appointment[]> {
  if (!client || !isSupabaseConfigured()) return []
  const slug = await resolveBusinessSlug(client, businessId)
  const lastDay = new Date(year, month, 0).getDate()
  const pad = (n: number) => String(n).padStart(2, "0")
  const fromDate = `${year}-${pad(month)}-01`
  const toDate = `${year}-${pad(month)}-${pad(lastDay)}`
  return getBookingsForBusinessBetweenDates(client, businessId, slug, fromDate, toDate)
}

export async function getBookingsForCurrentBusiness(
  client: BookingsStoreClient | null,
  knownBusinessId?: string | null,
): Promise<Appointment[]> {
  if (!isSupabaseConfigured() || !client) return []
  const bid = knownBusinessId?.trim() || (await getCurrentBusinessProfileIdForClient(client))
  if (!bid) return []
  const slug = await resolveBusinessSlug(client, bid)
  return getBookingsForBusiness(client, bid, slug)
}

export type CreateOnlineBookingInput = {
  businessSlug: string
  serviceId: string
  clientName: string
  clientPhone: string
  clientEmail?: string
  appointmentDate: string
  appointmentTime: string
  customerNote?: string
  staffId?: string | null
}

function isCreateBookingSlotConflict(message: string | undefined, code?: string): boolean {
  const m = (message ?? "").toLowerCase()
  if (code === "23505") return true
  return (
    m.includes("slot_taken") ||
    m.includes("duplicate key") ||
    m.includes("bookings_unique_active_slot") ||
    m.includes("unique constraint") ||
    m.includes("bookings_unique_active")
  )
}

function mapCreateOnlineBookingError(message: string | undefined): string {
  const m = (message ?? "").toLowerCase()
  if (m.includes("slot_taken")) return "slot_taken"
  if (m.includes("staff_service_not_allowed")) return "staff_service_not_allowed"
  if (m.includes("staff_not_found")) return "staff_not_found"
  if (m.includes("service_not_found")) return "service_not_found"
  if (m.includes("business_not_found")) return "business_not_found"
  return message ?? "unknown_error"
}

function isCreateOnlineBookingSignatureMismatch(
  message: string | undefined,
  code?: string
): boolean {
  if (code === "PGRST202") return true
  const m = (message ?? "").toLowerCase()
  return (
    m.includes("function public.create_online_booking") &&
    (m.includes("does not exist") || m.includes("could not find the function"))
  )
}

function isCreateOnlineBookingLegacySchemaError(message: string | undefined): boolean {
  const m = (message ?? "").toLowerCase()
  return (
    m.includes("column b2.staff_id does not exist") ||
    m.includes("column ss.staff_id does not exist") ||
    m.includes("column b2.staff_name does not exist") ||
    m.includes("column \"staff_id\" of relation \"bookings\" does not exist") ||
    m.includes("column \"staff_name\" of relation \"bookings\" does not exist")
  )
}

export async function createOnlineBooking(
  client: BookingsStoreClient | null,
  input: CreateOnlineBookingInput
): Promise<{ ok: boolean; id?: string; confirmationToken?: string; error?: string }> {
  if (!client || !isSupabaseConfigured()) {
    return { ok: false, error: "no_client" }
  }
  const normalizedSlug = input.businessSlug.trim().toLowerCase()
  if (normalizedSlug === DEMO_BOOKING_SLUG) {
    return { ok: false, error: "demo_slug" }
  }
  const dateStr = input.appointmentDate.trim()
  const timeStr = input.appointmentTime.trim()
  const free = await isSlotAvailableForPublicSlug(client, normalizedSlug, dateStr, timeStr)
  if (!free) {
    return { ok: false, error: "slot_taken" }
  }
  const payloadV9 = {
    p_slug: normalizedSlug,
    p_service_id: input.serviceId,
    p_client_name: input.clientName.trim(),
    p_client_phone: input.clientPhone.trim(),
    p_client_email: input.clientEmail?.trim() || null,
    p_appointment_date: dateStr,
    p_appointment_time: toPgTimeHm(timeStr),
    p_customer_note: input.customerNote?.trim() || null,
    p_staff_id: input.staffId ?? null,
  }
  let { data, error } = await client.rpc("create_online_booking", payloadV9)
  if (
    error &&
    (isCreateOnlineBookingSignatureMismatch(error.message, error.code) ||
      isCreateOnlineBookingLegacySchemaError(error.message))
  ) {
    const fallbackV8 = await client.rpc("create_online_booking", {
      p_slug: normalizedSlug,
      p_service_id: input.serviceId,
      p_client_name: input.clientName.trim(),
      p_client_phone: input.clientPhone.trim(),
      p_client_email: input.clientEmail?.trim() || null,
      p_appointment_date: dateStr,
      p_appointment_time: toPgTimeHm(timeStr),
      p_customer_note: input.customerNote?.trim() || null,
    })
    data = fallbackV8.data
    error = fallbackV8.error
  }
  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[bookings.createOnlineBooking.rpc.error]", {
        code: error.code ?? null,
        message: error.message ?? null,
        details: error.details ?? null,
        hint: error.hint ?? null,
      })
    }
    if (isCreateBookingSlotConflict(error.message, error.code)) {
      return { ok: false, error: "slot_taken" }
    }
    return { ok: false, error: mapCreateOnlineBookingError(error.message) }
  }
  const row = Array.isArray(data) ? data[0] : data
  if (!row?.id || !row.confirmation_token) return { ok: false, error: "empty" }
  if (process.env.NODE_ENV === "development" && row.client_id) {
    console.info("[clients.findOrCreate]", {
      businessId: "(online_booking)",
      outcome: "created_or_linked",
      clientId: row.client_id,
    })
  }
  // Legacy DB fallback: if user explicitly selected staff, make a best-effort update
  // so Visits panel can display assigned person even when legacy RPC omitted it.
  if (input.staffId && String(input.staffId).trim().length > 0) {
    const selectedStaffId = String(input.staffId).trim()
    let selectedStaffName: string | null = null
    const { data: sm } = await client
      .from("staff_members")
      .select("name")
      .eq("id", selectedStaffId)
      .maybeSingle()
    if (sm && typeof sm.name === "string" && sm.name.trim().length > 0) {
      selectedStaffName = sm.name.trim()
    }
    const { error: updateStaffErr } = await client
      .from("bookings")
      .update({
        staff_id: selectedStaffId,
        staff_name: selectedStaffName,
      })
      .eq("id", String(row.id))
    if (updateStaffErr && process.env.NODE_ENV === "development") {
      const m = String(updateStaffErr.message ?? "")
      if (
        !m.includes("column \"staff_id\" of relation \"bookings\" does not exist") &&
        !m.includes("column \"staff_name\" of relation \"bookings\" does not exist")
      ) {
        console.warn("[bookings.createOnlineBooking.staffFallbackUpdate.error]", {
          code: updateStaffErr.code ?? null,
          message: updateStaffErr.message ?? null,
        })
      }
    }
  }
  const confirmAfterCreate = await updateBookingByConfirmationToken(
    client,
    String(row.confirmation_token),
    "confirm",
    {},
  )
  if (!confirmAfterCreate.ok && process.env.NODE_ENV === "development") {
    console.warn("[bookings.createOnlineBooking.confirmAfterCreate]", confirmAfterCreate.error)
  }
  dispatchBookingsUpdated()
  return { ok: true, id: row.id, confirmationToken: row.confirmation_token }
}

export type CreateManualBookingInput = {
  clientName: string
  clientPhone: string
  clientEmail?: string
  serviceName: string
  /** Opcjonalnie UUID usługi z Supabase (powiązanie z staff_services). */
  serviceId?: string | null
  staffId?: string | null
  staffName?: string | null
  serviceDurationMinutes?: number | null
  serviceBreakMinutes?: number | null
  servicePrice?: number | null
  serviceCurrency?: string | null
  appointmentDate: string
  appointmentTime: string
  status: string
  customerNote?: string
  /** Ręczne dodanie z panelu: zawsze zapisujemy `manual`. */
  bookingSource?: "manual"
}

export async function createManualBooking(
  client: BookingsStoreClient | null,
  businessProfileId: string | null,
  input: CreateManualBookingInput
): Promise<{ ok: boolean; id?: string; confirmationToken?: string; error?: string }> {
  if (!isSupabaseBookingsPath(client, businessProfileId)) {
    return { ok: false, error: "no_supabase" }
  }
  const staffScope =
    typeof input.staffId === "string" && input.staffId.trim().length > 0
      ? input.staffId.trim()
      : null
  const durationMin = Math.max(1, Math.floor(Number(input.serviceDurationMinutes ?? 0) || 0))
  const breakMin = Math.max(0, Math.floor(Number(input.serviceBreakMinutes ?? 0) || 0))
  if (staffScope) {
    const overlap = await hasStaffSchedulingIntervalOverlap(
      client!,
      businessProfileId!,
      input.appointmentDate.trim(),
      input.appointmentTime.trim(),
      durationMin,
      staffScope,
      { breakMinutes: breakMin },
    )
    if (overlap) {
      return { ok: false, error: "slot_taken" }
    }
  } else {
    const taken = await isAppointmentSlotTakenByOtherBooking(
      client!,
      businessProfileId!,
      input.appointmentDate.trim(),
      input.appointmentTime.trim(),
      { staffScope: null },
    )
    if (taken) {
      return { ok: false, error: "slot_taken" }
    }
  }
  const fc = await findOrCreateClient(client, businessProfileId!, {
    fullName: input.clientName,
    email: input.clientEmail ?? "",
    phone: input.clientPhone,
  })
  if (!fc.ok) {
    return { ok: false, error: fc.error }
  }
  const dateStr = input.appointmentDate.trim()
  const row: TablesInsert<"bookings"> = {
    business_id: businessProfileId!,
    client_id: fc.clientId,
    service_id:
      typeof input.serviceId === "string" && input.serviceId.trim().length > 0 ? input.serviceId.trim() : null,
    client_name: input.clientName.trim(),
    client_phone: input.clientPhone.trim(),
    client_email: input.clientEmail?.trim() || null,
    service_name: input.serviceName.trim(),
    service_duration_minutes: Math.max(
      0,
      Math.floor(Number(input.serviceDurationMinutes ?? 0) || 0)
    ),
    service_break_minutes: breakMin,
    service_price: Number.isFinite(Number(input.servicePrice))
      ? Math.max(0, Number(input.servicePrice))
      : 0,
    service_currency: (input.serviceCurrency?.trim() || "PLN").slice(0, 8),
    appointment_date: dateStr,
    appointment_time: toPgTimeHm(input.appointmentTime.trim()),
    status: input.status,
    source: input.bookingSource ?? "manual",
    customer_note: input.customerNote?.trim() || null,
    staff_id:
      typeof input.staffId === "string" && input.staffId.trim().length > 0 ? input.staffId.trim() : null,
    staff_name: input.staffName?.trim() ? input.staffName.trim() : null,
  }
  const { data, error } = await client!.from("bookings").insert(row).select("id, confirmation_token").single()
  if (error || !data) {
    if (isCreateBookingSlotConflict(error?.message, error?.code)) {
      return { ok: false, error: "slot_taken" }
    }
    return { ok: false, error: error?.message ?? "insert" }
  }
  dispatchBookingsUpdated()
  return { ok: true, id: data.id, confirmationToken: data.confirmation_token }
}

export async function updateBooking(
  client: BookingsStoreClient | null,
  businessProfileId: string | null,
  bookingId: string,
  updates: TablesUpdate<"bookings">
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseBookingsPath(client, businessProfileId)) {
    return { ok: false, error: "no_supabase" }
  }
  if (Object.keys(updates).length === 0) return { ok: true }
  const { error } = await client!.from("bookings").update(updates).eq("id", bookingId)
  if (error) return { ok: false, error: error.message }
  dispatchBookingsUpdated()
  return { ok: true }
}

type UpdateBookingStatusOpts = {
  lastUpdatedBy?: "customer" | "business" | "system"
  lastStatusChangeSource?:
    | "manual"
    | "confirm"
    | "cancel"
    | "system"
    | "auto_reminder_24h"
    | "automatic_24h_reminder"
  lastChangeType?: PublicBooking["lastChangeType"]
  reminderSentAtIso?: string | null
  reminderStatus?: string | null
  reminderDueAtIso?: string | null
}

export async function updateBookingStatus(
  client: BookingsStoreClient | null,
  businessProfileId: string | null,
  bookingId: string,
  status: AppointmentStatus,
  options: UpdateBookingStatusOpts = {}
): Promise<{ ok: boolean; error?: string }> {
  const dbStatus = mapAppointmentStatusToDb(status)
  const patch: TablesUpdate<"bookings"> = {
    status: dbStatus,
    last_updated_by: options.lastUpdatedBy ?? "business",
    last_status_change_source: options.lastStatusChangeSource ?? "manual",
    last_change_type: options.lastChangeType ?? null,
  }
  if (options.reminderSentAtIso !== undefined) patch.reminder_sent_at = options.reminderSentAtIso
  if (options.reminderStatus !== undefined) patch.reminder_status = options.reminderStatus
  if (options.reminderDueAtIso !== undefined) patch.reminder_due_at = options.reminderDueAtIso
  return updateBooking(client, businessProfileId, bookingId, patch)
}

export async function deleteBooking(
  client: BookingsStoreClient | null,
  businessProfileId: string | null,
  bookingId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseBookingsPath(client, businessProfileId)) return { ok: false, error: "no_supabase" }
  const { error } = await client!
    .from("bookings")
    .delete()
    .eq("id", bookingId)
    .eq("business_id", businessProfileId!)
  if (error) return { ok: false, error: error.message }
  dispatchBookingsUpdated()
  return { ok: true }
}

export async function fetchSupabaseBookingAsPublic(
  client: BookingsStoreClient,
  bookingUuid: string,
  businessSlug: string
): Promise<PublicBooking | null> {
  const { data, error } = await client
    .from("bookings")
    .select("*")
    .eq("id", bookingUuid)
    .maybeSingle()
  if (error || !data) return null
  return mapBookingRowToPublicBooking(data as Tables<"bookings">, businessSlug)
}

export async function applyPublicBookingPatchToSupabase(
  client: BookingsStoreClient | null,
  businessProfileId: string | null,
  bookingUuid: string,
  patch: Partial<PublicBooking>
): Promise<{ ok: boolean; error?: string }> {
  const dbPatch = publicBookingPatchToDbUpdate(patch)
  return updateBooking(client, businessProfileId, bookingUuid, dbPatch)
}

export async function getBookingByConfirmationToken(
  client: BookingsStoreClient | null,
  token: string
): Promise<PublicBooking | null> {
  if (!client || !isSupabaseConfigured()) return null
  const { data, error } = await client.rpc("get_booking_by_confirmation_token", {
    p_token: token.trim(),
  })
  if (error || data == null || typeof data !== "object") return null
  const o = data as Record<string, unknown>
  if (typeof o.id !== "string" || typeof o.business_slug !== "string") return null
  const rowLike: Tables<"bookings"> = {
    id: o.id as string,
    business_id: (o.business_id as string) ?? "",
    service_id: (o.service_id as string | null) ?? null,
    confirmation_token: (o.confirmation_token as string) ?? "",
    client_id: (o.client_id as string | null | undefined) ?? null,
    client_name: String(o.client_name ?? ""),
    client_phone: String(o.client_phone ?? ""),
    client_email: (o.client_email as string | null) ?? null,
    service_name: String(o.service_name ?? ""),
    service_duration_minutes: Number(o.service_duration_minutes ?? 0),
    service_break_minutes: Number(o.service_break_minutes ?? 0),
    service_price: Number(o.service_price ?? 0),
    service_currency: String(o.service_currency ?? "PLN"),
    staff_id: (o.staff_id as string | null) ?? null,
    staff_name: (o.staff_name as string | null) ?? null,
    proposed_staff_id: (o.proposed_staff_id as string | null) ?? null,
    proposed_staff_name: (o.proposed_staff_name as string | null) ?? null,
    appointment_date: String(o.appointment_date ?? "").slice(0, 10),
    appointment_time: String(o.appointment_time ?? "09:00:00"),
    status: (() => {
      const s = String(o.status ?? "confirmed")
      return s === "booked" || s === "pending" ? "confirmed" : s
    })(),
    source: String(o.source ?? "manual"),
    customer_note: (o.customer_note as string | null) ?? null,
    business_note: (o.business_note as string | null) ?? null,
    proposed_date: o.proposed_date ? String(o.proposed_date).slice(0, 10) : null,
    proposed_time: (o.proposed_time as string | null) ?? null,
    proposed_service_id: (o.proposed_service_id as string | null) ?? null,
    proposed_service_name: (o.proposed_service_name as string | null) ?? null,
    proposed_service_duration_minutes:
      o.proposed_service_duration_minutes != null
        ? Number(o.proposed_service_duration_minutes)
        : null,
    proposed_service_price:
      o.proposed_service_price != null ? Number(o.proposed_service_price) : null,
    previous_date: o.previous_date ? String(o.previous_date).slice(0, 10) : null,
    previous_time: (o.previous_time as string | null) ?? null,
    previous_service_name: (o.previous_service_name as string | null) ?? null,
    last_updated_by: (o.last_updated_by as string | null) ?? null,
    last_change_type: (o.last_change_type as string | null) ?? null,
    last_status_change_source: (o.last_status_change_source as string | null) ?? null,
    status_before_request: (o.status_before_request as string | null) ?? null,
    reschedule_message: (o.reschedule_message as string | null) ?? null,
    internal_note: (o.internal_note as string | null) ?? null,
    accepted_proposal_at: (o.accepted_proposal_at as string | null) ?? null,
    confirmed_at: (o.confirmed_at as string | null) ?? null,
    business_proposal_kind: (o.business_proposal_kind as string | null) ?? null,
    previous_service_duration_minutes:
      o.previous_service_duration_minutes != null
        ? Number(o.previous_service_duration_minutes)
        : null,
    previous_service_price:
      o.previous_service_price != null ? Number(o.previous_service_price) : null,
    reminder_due_at: typeof o.reminder_due_at === "string" ? o.reminder_due_at : null,
    reminder_sent_at: typeof o.reminder_sent_at === "string" ? o.reminder_sent_at : null,
    reminder_status: typeof o.reminder_status === "string" ? o.reminder_status : null,
    reminder_error: typeof o.reminder_error === "string" ? o.reminder_error : null,
    first_reminder_due_at: typeof o.first_reminder_due_at === "string" ? o.first_reminder_due_at : null,
    first_reminder_sent_at: typeof o.first_reminder_sent_at === "string" ? o.first_reminder_sent_at : null,
    first_reminder_status: typeof o.first_reminder_status === "string" ? o.first_reminder_status : null,
    second_reminder_due_at: typeof o.second_reminder_due_at === "string" ? o.second_reminder_due_at : null,
    second_reminder_sent_at: typeof o.second_reminder_sent_at === "string" ? o.second_reminder_sent_at : null,
    second_reminder_status: typeof o.second_reminder_status === "string" ? o.second_reminder_status : null,
    second_reminder_error: typeof o.second_reminder_error === "string" ? o.second_reminder_error : null,
    cancelled_at: typeof o.cancelled_at === "string" ? o.cancelled_at : null,
    cancelled_by: typeof o.cancelled_by === "string" ? o.cancelled_by : null,
    cancellation_note: typeof o.cancellation_note === "string" ? o.cancellation_note : null,
    google_calendar_event_id:
      typeof o.google_calendar_event_id === "string" ? o.google_calendar_event_id : null,
    created_at: String(o.created_at ?? ""),
    updated_at: String(o.updated_at ?? ""),
  }
  return mapBookingRowToPublicBooking(rowLike, o.business_slug as string)
}

export async function updateBookingByConfirmationToken(
  client: BookingsStoreClient | null,
  token: string,
  action: "confirm" | "cancel",
  payload: Record<string, unknown> = {}
): Promise<{ ok: boolean; error?: string }> {
  if (!client || !isSupabaseConfigured()) return { ok: false, error: "no_client" }
  const { data, error } = await client.rpc("update_booking_by_confirmation_token", {
    p_token: token.trim(),
    p_action: action,
    p_payload: payload as Json,
  })
  if (error) return { ok: false, error: error.message }
  const o = data as { ok?: boolean; error?: string } | null
  if (!o?.ok) return { ok: false, error: o?.error ?? "rpc_failed" }
  dispatchBookingsUpdated()
  return { ok: true }
}
