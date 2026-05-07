import { isOnlineBookingSource } from "@/lib/bookings/booking-source"
import type { StaffMember } from "@/types/domain"

/** Minimal shape needed to render staff line (booking / appointment / public booking). */
export type BookingStaffLike = {
  staffId?: string | null
  staffName?: string | null
  source?: string | null
  status?: string | null
  proposedStaffId?: string | null
}

/** Wartość filtra osób na liście wizyt: `all`, `unassigned` lub `staff_members.id`. */
export type StaffAppointmentFilterValue = "all" | "unassigned" | string

/**
 * Uzupełnienie wyświetlanej osoby dla wizyty: snapshot `staff_name`, nazwa po `staff_id` z listy usługi,
 * albo jedyna osoba przypisana do usługi.
 */
export function inferBookingStaffDisplayName(
  staffId: string | null | undefined,
  staffNameSnapshot: string | null | undefined,
  serviceStaff: StaffMember[] | undefined
): string | undefined {
  const snap = (staffNameSnapshot ?? "").trim()
  if (snap) return snap
  const sid = typeof staffId === "string" ? staffId.trim() : ""
  const list = serviceStaff ?? []
  if (sid && list.some((x) => x.id === sid)) {
    return list.find((x) => x.id === sid)?.name.trim()
  }
  if (!sid && list.length === 1) {
    return list[0]!.name.trim()
  }
  return undefined
}

export function bookingMatchesStaffFilter(
  a: BookingStaffLike,
  staffFilter: StaffAppointmentFilterValue
): boolean {
  if (staffFilter === "all") return true
  const sid = typeof a.staffId === "string" ? a.staffId.trim() : ""
  if (staffFilter === "unassigned") return sid.length === 0
  return sid === staffFilter
}

export function hasAssignedStaff(b: BookingStaffLike): boolean {
  const name = (b.staffName ?? "").trim()
  if (name.length > 0) return true
  const id = typeof b.staffId === "string" ? b.staffId.trim() : ""
  return id.length > 0
}

/** Wyświetlane nazwisko lub snapshot zapisany w booking (bez join z staff_members). */
export function getBookingStaffName(b: BookingStaffLike): string | null {
  const n = (b.staffName ?? "").trim()
  return n.length > 0 ? n : null
}

export type StaffCaptionVariant = "full" | "compact"

/**
 * Jedna linia pod wizytą (PL/EN przez `t`).
 * `compact` - krótszy tekst na dashboard (np. samo nazwisko lub skrót).
 */
export function getBookingStaffCaptionLine(
  b: BookingStaffLike,
  t: (key: string) => string,
  variant: StaffCaptionVariant = "full",
  resolvedDisplayName?: string | null
): string {
  const name =
    getBookingStaffName(b) ??
    ((resolvedDisplayName ?? "").trim().length > 0 ? (resolvedDisplayName ?? "").trim() : null)
  if (name) {
    return variant === "compact"
      ? name
      : t("appointments.staffLineWithName").replace("{name}", name)
  }
  if (isOnlineBookingSource(b.source) && !b.staffId) {
    const anyStaff = t("team.anyStaff")
    return variant === "compact" ? anyStaff : t("appointments.staffLineWithName").replace("{name}", anyStaff)
  }
  return variant === "compact"
    ? t("appointments.staffNotAssignedShort")
    : t("appointments.staffLineNotAssigned")
}

/** Etykieta jak w szczegółach (np. /confirm): wartość bez prefiksu "Osoba:". */
export function getBookingStaffDetailValue(b: BookingStaffLike, t: (key: string) => string): string {
  const name = getBookingStaffName(b)
  if (name) return name
  if (isOnlineBookingSource(b.source) && !b.staffId) return t("team.anyStaff")
  return t("appointments.staffNotAssignedShort")
}

/** Pełna linia "Osoba: ..." (tłumaczenia przez `t`, nie locale string). */
export function getBookingStaffLabel(b: BookingStaffLike, t: (key: string) => string): string {
  return getBookingStaffCaptionLine(b, t, "full")
}

/** Czy na /confirm pokazać wiersz (nazwisko, dowolna osoba online - nie pusty brak danych). */
export function shouldShowStaffDetailRow(b: BookingStaffLike): boolean {
  if (getBookingStaffName(b)) return true
  if (isOnlineBookingSource(b.source) && !b.staffId) return true
  return false
}
