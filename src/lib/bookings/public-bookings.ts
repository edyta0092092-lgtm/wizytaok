import { normalizeBookingSource } from "@/lib/bookings/booking-source"
import type { Appointment, AppointmentStatus, BookingSource } from "@/types/domain"

export const PUBLIC_BOOKINGS_STORAGE_KEY = "public-bookings"

export type PublicBookingStatus =
  | "booked"
  | "pending"
  | "confirmed"
  | "cancelled"
  | "no_show"

export type PublicBooking = {
  id: string
  /** Token z Supabase do linku /confirm/[token]; brak przy wyłączonym Supabase. */
  confirmationToken?: string
  businessSlug: string
  /** Id usługi z listy (mock /services), opcjonalne dla starych zapisów. */
  serviceId?: string
  staffId?: string
  staffName?: string
  serviceName: string
  serviceDurationMinutes: number
  servicePrice: number
  date: string
  time: string
  customerName: string
  customerPhone: string
  customerEmail?: string
  note?: string
  /** Ostatnia notatka od klienta (np. przy zmianie terminu/usługi). */
  customerNote?: string
  /** Prośba o zmianę terminu od klienta (tekst z formularza). */
  rescheduleMessage?: string
  proposedDate?: string
  proposedTime?: string
  proposedServiceName?: string
  proposedServiceDuration?: number
  proposedServicePrice?: number
  proposedStaffId?: string
  proposedStaffName?: string
  businessNote?: string
  internalNote?: string
  statusBeforeRequest?: "booked" | "confirmed"
  status: PublicBookingStatus
  source: BookingSource
  createdAt: string
  reminderDueAt?: string
  reminderSentAt?: string
  reminderStatus?: string
  reminderError?: string
  firstReminderDueAt?: string
  firstReminderSentAt?: string
  firstReminderStatus?: string
  secondReminderDueAt?: string
  secondReminderSentAt?: string
  secondReminderStatus?: string
  secondReminderError?: string
  lastUpdatedBy?: "customer" | "business" | "system"
  updatedAt?: string
  lastStatusChangeAt?: string
  lastStatusChangeSource?: "manual" | "confirm" | "system" | "auto_reminder_24h" | "automatic_24h_reminder"
  /** Termin zapisany w momencie propozycji firmy - przed zmianą na proposed*. */
  previousDate?: string
  previousTime?: string
  previousServiceName?: string
  previousServiceDuration?: number
  previousServicePrice?: number
  lastChangeType?:
    | "business_proposal_accepted"
    | "customer_request_accepted"
    | "customer_service_request_accepted"
    | "customer_request_rejected"
    | "reminder_24h_sent"
  acceptedProposalAt?: string
  businessProposalKind?: "time" | "service" | "both"
  cancelledAt?: string
  cancelledBy?: string
  cancellationNote?: string
}

/** Zapis legacy z public-booking (camelCase jak w MVP). */
type LegacyStoredPublicBooking = {
  id?: string
  businessSlug?: string
  serviceId?: string
  serviceName?: string
  durationMinutes?: number
  price?: number
  /** YYYY-MM-DD */
  day?: string
  date?: string
  time?: string
  fullName?: string
  phone?: string
  email?: string
  note?: string
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  createdAt?: string
  status?: string
  source?: string
  rescheduleMessage?: string
  customerNote?: string
  lastUpdatedBy?: string
  updatedAt?: string
  statusBeforeRequest?: string
  previousDate?: string
  previousTime?: string
  previousServiceName?: string
  previousServiceDuration?: number
  previousServicePrice?: number
  lastChangeType?: string
  acceptedProposalAt?: string
  businessProposalKind?: string
}

function parseStoredBookingStatus(raw: unknown): PublicBookingStatus {
  if (raw === "booked") return "booked"
  if (raw === "pending") return "pending"
  if (raw === "confirmed") return "confirmed"
  if (raw === "cancelled") return "cancelled"
  if (raw === "no_show") return "no_show"
  if (
    raw === "reschedule_requested" ||
    raw === "change_requested" ||
    raw === "reschedule" ||
    raw === "business_reschedule_proposed"
  ) {
    return "booked"
  }
  return "booked"
}

function coercePublicBooking(raw: unknown): PublicBooking | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as LegacyStoredPublicBooking & Partial<PublicBooking>
  const id = typeof o.id === "string" ? o.id : null
  if (!id) return null

  const dateRaw =
    typeof o.date === "string" ? o.date : typeof o.day === "string" ? o.day : ""
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) return null

  const timeRaw =
    typeof o.time === "string" &&
    /^(\d{1,2}):(\d{2})$/.test(o.time.trim())
      ? o.time.trim()
      : "09:00"

  const serviceDurationMinutes =
    typeof o.serviceDurationMinutes === "number"
      ? o.serviceDurationMinutes
      : typeof o.durationMinutes === "number"
        ? o.durationMinutes
        : 0

  const servicePrice =
    typeof o.servicePrice === "number"
      ? o.servicePrice
      : typeof o.price === "number"
        ? o.price
        : 0

  const customerName =
    typeof o.customerName === "string"
      ? o.customerName
      : typeof o.fullName === "string"
        ? o.fullName
        : ""

  const customerPhone =
    typeof o.customerPhone === "string"
      ? o.customerPhone
      : typeof o.phone === "string"
        ? o.phone
        : ""

  const businessSlug = typeof o.businessSlug === "string" ? o.businessSlug : ""

  const serviceName =
    typeof o.serviceName === "string" ? o.serviceName : ""

  const createdAt =
    typeof o.createdAt === "string" ? o.createdAt : new Date(0).toISOString()

  const status = parseStoredBookingStatus(o.status)

  const rescheduleMessage =
    typeof o.rescheduleMessage === "string" && o.rescheduleMessage.trim().length > 0
      ? o.rescheduleMessage.trim()
      : undefined

  const customerNote =
    typeof o.customerNote === "string" && o.customerNote.trim().length > 0
      ? o.customerNote.trim()
      : undefined

  const lastUpdatedBy: "customer" | "business" | "system" | undefined =
    o.lastUpdatedBy === "customer" || o.lastUpdatedBy === "business" || o.lastUpdatedBy === "system"
      ? o.lastUpdatedBy
      : undefined

  const updatedAt =
    typeof o.updatedAt === "string" && o.updatedAt.trim().length > 0
      ? o.updatedAt.trim()
      : undefined
  const lastStatusChangeAt =
    typeof o.lastStatusChangeAt === "string" && o.lastStatusChangeAt.trim().length > 0
      ? o.lastStatusChangeAt.trim()
      : undefined
  const lastStatusChangeSource:
    | "manual"
    | "confirm"
    | "system"
    | "auto_reminder_24h"
    | "automatic_24h_reminder"
    | undefined =
    o.lastStatusChangeSource === "manual" ||
    o.lastStatusChangeSource === "confirm" ||
    o.lastStatusChangeSource === "system" ||
    o.lastStatusChangeSource === "auto_reminder_24h" ||
    o.lastStatusChangeSource === "automatic_24h_reminder"
      ? o.lastStatusChangeSource
      : undefined

  const serviceIdOut =
    typeof o.serviceId === "string" && o.serviceId.trim().length > 0
      ? o.serviceId.trim()
      : undefined
  const statusBeforeRequest: "booked" | "confirmed" | undefined =
    o.statusBeforeRequest === "booked" || o.statusBeforeRequest === "confirmed"
      ? o.statusBeforeRequest
      : undefined

  const previousDate =
    typeof o.previousDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.previousDate)
      ? o.previousDate
      : undefined
  const previousTime =
    typeof o.previousTime === "string" && /^(\d{1,2}):(\d{2})$/.test(o.previousTime.trim())
      ? o.previousTime.trim()
      : undefined

  const lastChangeType: PublicBooking["lastChangeType"] | undefined =
    o.lastChangeType === "business_proposal_accepted"
      ? "business_proposal_accepted"
      : o.lastChangeType === "customer_request_accepted"
        ? "customer_request_accepted"
        : o.lastChangeType === "customer_service_request_accepted"
          ? "customer_service_request_accepted"
          : o.lastChangeType === "customer_request_rejected"
            ? "customer_request_rejected"
            : o.lastChangeType === "reminder_24h_sent"
              ? "reminder_24h_sent"
              : undefined

  const acceptedProposalAt =
    typeof o.acceptedProposalAt === "string" && o.acceptedProposalAt.trim().length > 0
      ? o.acceptedProposalAt.trim()
      : undefined

  const businessProposalKind: "time" | "service" | "both" | undefined =
    o.businessProposalKind === "service"
      ? "service"
      : o.businessProposalKind === "time"
        ? "time"
        : o.businessProposalKind === "both"
          ? "both"
          : undefined

  const previousServiceName =
    typeof o.previousServiceName === "string" && o.previousServiceName.trim().length > 0
      ? o.previousServiceName.trim()
      : undefined
  const previousServiceDuration =
    typeof o.previousServiceDuration === "number" ? o.previousServiceDuration : undefined
  const previousServicePrice =
    typeof o.previousServicePrice === "number" ? o.previousServicePrice : undefined

  return {
    id,
    businessSlug,
    serviceId: serviceIdOut,
    serviceName,
    serviceDurationMinutes,
    servicePrice,
    date: dateRaw,
    time: timeRaw,
    customerName,
    customerPhone,
    customerEmail:
      typeof o.customerEmail === "string"
        ? o.customerEmail
        : typeof o.email === "string"
          ? o.email
          : undefined,
    note: typeof o.note === "string" ? o.note : undefined,
    customerNote,
    rescheduleMessage,
    proposedDate:
      typeof o.proposedDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.proposedDate)
        ? o.proposedDate
        : undefined,
    proposedTime:
      typeof o.proposedTime === "string" && /^(\d{1,2}):(\d{2})$/.test(o.proposedTime.trim())
        ? o.proposedTime.trim()
        : undefined,
    proposedServiceName:
      typeof o.proposedServiceName === "string" && o.proposedServiceName.trim().length > 0
        ? o.proposedServiceName.trim()
        : undefined,
    proposedServiceDuration:
      typeof o.proposedServiceDuration === "number" ? o.proposedServiceDuration : undefined,
    proposedServicePrice: typeof o.proposedServicePrice === "number" ? o.proposedServicePrice : undefined,
    businessNote:
      typeof o.businessNote === "string" && o.businessNote.trim().length > 0
        ? o.businessNote.trim()
        : undefined,
    internalNote:
      typeof o.internalNote === "string" && o.internalNote.trim().length > 0
        ? o.internalNote.trim()
        : undefined,
    statusBeforeRequest,
    status,
    source: normalizeBookingSource(typeof o.source === "string" ? o.source : "online"),
    createdAt,
    lastUpdatedBy,
    updatedAt,
    lastStatusChangeAt,
    lastStatusChangeSource,
    previousDate,
    previousTime,
    previousServiceName,
    previousServiceDuration,
    previousServicePrice,
    lastChangeType,
    acceptedProposalAt,
    businessProposalKind,
    firstReminderDueAt: typeof o.firstReminderDueAt === "string" ? o.firstReminderDueAt : undefined,
    firstReminderSentAt: typeof o.firstReminderSentAt === "string" ? o.firstReminderSentAt : undefined,
    firstReminderStatus: typeof o.firstReminderStatus === "string" ? o.firstReminderStatus : undefined,
    secondReminderDueAt: typeof o.secondReminderDueAt === "string" ? o.secondReminderDueAt : undefined,
    secondReminderSentAt: typeof o.secondReminderSentAt === "string" ? o.secondReminderSentAt : undefined,
    secondReminderStatus: typeof o.secondReminderStatus === "string" ? o.secondReminderStatus : undefined,
    secondReminderError: typeof o.secondReminderError === "string" ? o.secondReminderError : undefined,
  }
}

/** Ostatni wpis w tablicy wygrywa przy tym samym `id`. */
function dedupePublicBookingsKeepLast(bookings: PublicBooking[]): PublicBooking[] {
  const indexById = new Map<string, number>()
  bookings.forEach((b, i) => {
    indexById.set(b.id, i)
  })
  return bookings.filter((b, i) => indexById.get(b.id) === i)
}

function coercePublicBookingArray(parsed: unknown): PublicBooking[] {
  if (!Array.isArray(parsed)) return []
  const out: PublicBooking[] = []
  for (const item of parsed) {
    const b = coercePublicBooking(item)
    if (b) out.push(b)
  }
  return dedupePublicBookingsKeepLast(out)
}

/**
 * Parsuje kluczem `public-bookings` (tablica obiektów).
 * Na SSR lub bez window zwraca [].
 */
export function getPublicBookings(): PublicBooking[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(PUBLIC_BOOKINGS_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    const coercedSequential: PublicBooking[] = []
    for (const item of parsed) {
      const b = coercePublicBooking(item)
      if (b) coercedSequential.push(b)
    }
    const deduped = dedupePublicBookingsKeepLast(coercedSequential)
    const needsRepair =
      deduped.length !== coercedSequential.length || parsed.length !== coercedSequential.length
    if (needsRepair) {
      window.localStorage.setItem(PUBLIC_BOOKINGS_STORAGE_KEY, JSON.stringify(deduped))
      notifyPublicBookingStorageChanged()
    }
    return deduped
  } catch {
    return []
  }
}

/** Zapis rezerwacji online: bez duplikatów po `id` - istniejący wpis jest nadpisywany. */
export function savePublicBooking(booking: PublicBooking): void {
  if (typeof window === "undefined") return
  try {
    const normalized: PublicBooking = {
      ...booking,
      status: booking.status ?? "booked",
      source: normalizeBookingSource(booking.source ?? "online"),
    }
    const raw = window.localStorage.getItem(PUBLIC_BOOKINGS_STORAGE_KEY)
    let parsedRaw: unknown = []
    try {
      parsedRaw = raw ? JSON.parse(raw) : []
    } catch {
      parsedRaw = []
    }
    const base = coercePublicBookingArray(Array.isArray(parsedRaw) ? parsedRaw : [])
    const idx = base.findIndex((b) => b.id === normalized.id)
    const next =
      idx === -1 ? [...base, normalized] : [...base.slice(0, idx), normalized, ...base.slice(idx + 1)]
    window.localStorage.setItem(
      PUBLIC_BOOKINGS_STORAGE_KEY,
      JSON.stringify(dedupePublicBookingsKeepLast(next))
    )
    notifyPublicBookingStorageChanged()
  } catch {
    // MVP: brak throw
  }
}

export function notifyPublicBookingStorageChanged(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event("pw-public-bookings"))
}

/** Aktualizuje wpis po `id`; zwraca false, jeśli brak wpisu. */
export function updatePublicBooking(id: string, patch: Partial<PublicBooking>): boolean {
  if (typeof window === "undefined") return false
  try {
    let parsedRaw: unknown = []
    try {
      parsedRaw = JSON.parse(window.localStorage.getItem(PUBLIC_BOOKINGS_STORAGE_KEY) ?? "[]")
    } catch {
      parsedRaw = []
    }
    const all = coercePublicBookingArray(Array.isArray(parsedRaw) ? parsedRaw : [])
    const idx = all.findIndex((b) => b.id === id)
    if (idx === -1) return false
    const updated: PublicBooking = { ...all[idx], ...patch, id }
    const next = dedupePublicBookingsKeepLast([...all.slice(0, idx), updated, ...all.slice(idx + 1)])
    window.localStorage.setItem(PUBLIC_BOOKINGS_STORAGE_KEY, JSON.stringify(next))
    notifyPublicBookingStorageChanged()
    return true
  } catch {
    return false
  }
}

export function findPublicBookingById(id: string): PublicBooking | null {
  return getPublicBookings().find((b) => b.id === id) ?? null
}

/** Sygnatura stanu rezerwacji (localStorage lub obiekt z Supabase RPC). */
export function publicBookingRemoteSyncSignature(
  b: PublicBooking | null,
  missingKey?: string
): string {
  if (!b) {
    return missingKey != null ? `__missing__:${missingKey}` : "__missing__"
  }
  return JSON.stringify({
    st: b.status,
    dt: b.date,
    tm: b.time,
    svc: b.serviceName,
    sdm: b.serviceDurationMinutes,
    sp: b.servicePrice,
    pd: b.proposedDate ?? null,
    pt: b.proposedTime ?? null,
    psn: b.proposedServiceName ?? null,
    psd: b.proposedServiceDuration ?? null,
    psp: b.proposedServicePrice ?? null,
    bn: b.businessNote ?? null,
    cn: b.customerNote ?? null,
    rm: b.rescheduleMessage ?? null,
    sbr: b.statusBeforeRequest ?? null,
    prvD: b.previousDate ?? null,
    prvT: b.previousTime ?? null,
    prvSn: b.previousServiceName ?? null,
    prvSd: b.previousServiceDuration ?? null,
    prvSp: b.previousServicePrice ?? null,
    lct: b.lastChangeType ?? null,
    apa: b.acceptedProposalAt ?? null,
    bpk: b.businessProposalKind ?? null,
    lub: b.lastUpdatedBy ?? null,
    sid: b.serviceId ?? null,
    ino: b.internalNote ?? null,
    ua: b.updatedAt ?? null,
    ct: b.confirmationToken ?? null,
  })
}

/** Sygnatura rezerwacji do pollingu `/confirm/[id]` bez pełnego reloadu (pole localStorage). */
export function publicBookingSyncSignature(bookingId: string): string {
  return publicBookingRemoteSyncSignature(findPublicBookingById(bookingId), bookingId)
}

export function removePublicBooking(id: string): void {
  if (typeof window === "undefined") return
  try {
    let parsedRaw: unknown = []
    try {
      parsedRaw = JSON.parse(window.localStorage.getItem(PUBLIC_BOOKINGS_STORAGE_KEY) ?? "[]")
    } catch {
      parsedRaw = []
    }
    const prev = coercePublicBookingArray(Array.isArray(parsedRaw) ? parsedRaw : [])
    const next = dedupePublicBookingsKeepLast(prev.filter((b) => b.id !== id))
    window.localStorage.setItem(PUBLIC_BOOKINGS_STORAGE_KEY, JSON.stringify(next))
    notifyPublicBookingStorageChanged()
  } catch {
    // noop
  }
}

/** Lokalny start dnia dla ISO string zapisanego jako czas lokalny (parsuje komponent daty ISO). */
function localDayFromAppointmentStarts(isoUtc: string): number {
  const d = new Date(isoUtc)
  return startOfLocalDayMs(d)
}

export function startOfLocalDayMs(d: Date): number {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x.getTime()
}

/** Czy wizyta wypada w podany dzień lokalny (ref). */
export function isAppointmentOnLocalCalendarDay(startsAt: string, ref: Date): boolean {
  return localDayFromAppointmentStarts(startsAt) === startOfLocalDayMs(ref)
}

export function combineLocalDateTimeToUtcIso(date: string, time: string): string {
  const [yStr, moStr, dStr] = date.split("-")
  const [hStr, mStr = "00"] = time.trim().split(":")
  const y = Number(yStr)
  const mo = Number(moStr)
  const da = Number(dStr)
  const hh = Number(hStr)
  const mi = Number(mStr)
  return new Date(
    y,
    Number.isFinite(mo) ? mo - 1 : 0,
    Number.isFinite(da) ? da : 1,
    Number.isFinite(hh) ? hh : 9,
    Number.isFinite(mi) ? mi : 0,
    0,
    0
  ).toISOString()
}

function mapPublicStatusToAppointmentStatus(s: PublicBookingStatus): AppointmentStatus {
  switch (s) {
    case "booked":
      return "booked"
    case "pending":
      return "pending"
    case "confirmed":
      return "confirmed"
    case "cancelled":
      return "cancelled"
    case "no_show":
      return "no_show"
    default:
      return "booked"
  }
}

export function mapPublicBookingToAppointment(b: PublicBooking): Appointment {
  return {
    id: `pb-${b.id}`,
    confirmationToken: b.confirmationToken,
    businessSlug: b.businessSlug,
    clientName: b.customerName,
    phone: b.customerPhone,
    email: b.customerEmail,
    serviceLabel: b.serviceName,
    startsAt: combineLocalDateTimeToUtcIso(b.date, b.time),
    status: mapPublicStatusToAppointmentStatus(b.status),
    notes: [b.note, b.customerNote]
      .filter(
        (x) => typeof x === "string" && x.trim().length > 0
      )
      .join("\n\n") || undefined,
    rescheduleMessage: b.rescheduleMessage,
    proposedDate: b.proposedDate,
    proposedTime: b.proposedTime,
    proposedServiceName: b.proposedServiceName,
    proposedServiceDuration: b.proposedServiceDuration,
    proposedServicePrice: b.proposedServicePrice,
    proposedStaffId: b.proposedStaffId,
    proposedStaffName: b.proposedStaffName,
    customerNote: b.customerNote,
    businessNote: b.businessNote,
    internalNote: b.internalNote,
    lastUpdatedBy: b.lastUpdatedBy,
    lastStatusChangeAt: b.lastStatusChangeAt,
    lastStatusChangeSource: b.lastStatusChangeSource,
    statusBeforeRequest: b.statusBeforeRequest,
    previousDate: b.previousDate,
    previousTime: b.previousTime,
    previousServiceName: b.previousServiceName,
    previousServiceDuration: b.previousServiceDuration,
    previousServicePrice: b.previousServicePrice,
    lastChangeType: b.lastChangeType,
    acceptedProposalAt: b.acceptedProposalAt,
    businessProposalKind: b.businessProposalKind,
    noShowRisk: "none",
    source: normalizeBookingSource(b.source ?? "online"),
    serviceId: b.serviceId,
    staffId: b.staffId,
    staffName: b.staffName,
    reminderDueAt: b.reminderDueAt,
    reminderSentAt: b.reminderSentAt,
    reminderStatus: b.reminderStatus,
    reminderError: b.reminderError,
    firstReminderDueAt: b.firstReminderDueAt,
    firstReminderSentAt: b.firstReminderSentAt,
    firstReminderStatus: b.firstReminderStatus,
    secondReminderDueAt: b.secondReminderDueAt,
    secondReminderSentAt: b.secondReminderSentAt,
    secondReminderStatus: b.secondReminderStatus,
    secondReminderError: b.secondReminderError,
  }
}

export function unwrapPublicAppointmentId(uiId: string): string | null {
  const s = typeof uiId === "string" ? uiId.trim() : ""
  return s.startsWith("pb-") ? s.slice(3) : null
}
