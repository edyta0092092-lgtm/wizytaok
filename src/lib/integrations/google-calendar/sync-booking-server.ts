import { buildGoogleCalendarEventFromBooking } from "@/lib/integrations/google-calendar/build-event"
import {
  connectionEncryptedPayload,
  loadConnectionForBookingStaff,
} from "@/lib/integrations/google-calendar/connection-repository"
import {
  cancelCalendarEvent,
  insertCalendarEvent,
  patchCalendarEvent,
} from "@/lib/integrations/google-calendar/google-calendar-api"
import { refreshGoogleAccessToken } from "@/lib/integrations/google-calendar/google-oauth-client"
import { isGoogleCalendarPersistenceReady } from "@/lib/integrations/google-calendar/persistence-ready"
import type { GoogleCalendarSyncAction, GoogleCalendarSyncResult } from "@/lib/integrations/google-calendar/types"
import { decryptRefreshToken } from "@/lib/integrations/google-calendar/token-crypto"
import { getServiceRoleClient } from "@/lib/supabase/service-role"
import type { Tables } from "@/types/database"

const SKIP_STATUSES = new Set(["completed", "no_show"])

async function persistBookingEventId(bookingId: string, eventId: string | null): Promise<void> {
  const admin = getServiceRoleClient()
  if (!admin) return
  await admin
    .from("bookings")
    .update({ google_calendar_event_id: eventId } as never)
    .eq("id", bookingId)
}

async function readBookingEventId(booking: Tables<"bookings">): Promise<string | null> {
  const row = booking as Tables<"bookings"> & { google_calendar_event_id?: string | null }
  return row.google_calendar_event_id?.trim() || null
}

async function resolveAccessForConnection(
  connection: NonNullable<Awaited<ReturnType<typeof loadConnectionForBookingStaff>>>,
): Promise<{ accessToken: string; calendarId: string } | null> {
  if (!connection.google_calendar_id) return null
  const refresh = decryptRefreshToken(connectionEncryptedPayload(connection))
  if (!refresh) return null
  const tokens = await refreshGoogleAccessToken(refresh)
  if (!tokens?.access_token) return null
  return { accessToken: tokens.access_token, calendarId: connection.google_calendar_id }
}

/**
 * Synchronizacja wizyty z Google Calendar (serwer).
 * Wymaga migracji DB + zmiennych GOOGLE_CALENDAR_*.
 */
export async function syncBookingToGoogleCalendar(
  bookingId: string,
  action: GoogleCalendarSyncAction,
): Promise<GoogleCalendarSyncResult> {
  if (!(await isGoogleCalendarPersistenceReady())) {
    return { ok: true, skipped: true, reason: "persistence_not_ready" }
  }

  const admin = getServiceRoleClient()
  if (!admin) {
    return { ok: false, error: "service_unconfigured" }
  }

  const { data: bookingRow, error } = await admin
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle()

  if (error || !bookingRow) {
    return { ok: false, error: "booking_not_found" }
  }

  const booking = bookingRow as Tables<"bookings">

  if (action === "upsert" && SKIP_STATUSES.has(booking.status)) {
    return { ok: true, skipped: true, reason: "terminal_status_unchanged" }
  }

  if (action === "cancel" && SKIP_STATUSES.has(booking.status)) {
    return { ok: true, skipped: true, reason: "terminal_status_unchanged" }
  }

  const connection = await loadConnectionForBookingStaff(booking.business_id, booking.staff_id)
  if (!connection) {
    return { ok: true, skipped: true, reason: "no_calendar_connection" }
  }

  const access = await resolveAccessForConnection(connection)
  if (!access) {
    return { ok: true, skipped: true, reason: "token_unavailable" }
  }

  const { data: profile } = await admin
    .from("business_profiles")
    .select("slug, business_name")
    .eq("id", booking.business_id)
    .maybeSingle()

  const eventPayload = buildGoogleCalendarEventFromBooking({
    booking,
    businessSlug: profile?.slug ?? null,
    businessName: profile?.business_name ?? null,
    cancelled: action === "cancel" || booking.status === "cancelled",
  })

  const existingEventId = await readBookingEventId(booking)

  if (action === "cancel") {
    if (!existingEventId) {
      return { ok: true, skipped: true, reason: "no_linked_event" }
    }
    const cancelled = await patchCalendarEvent(access.accessToken, access.calendarId, existingEventId, {
      summary: eventPayload.summary,
      description: eventPayload.description,
      status: "cancelled",
    })
    if (!cancelled) {
      await cancelCalendarEvent(access.accessToken, access.calendarId, existingEventId)
    }
    return { ok: true, skipped: false, eventId: existingEventId }
  }

  if (existingEventId) {
    const patched = await patchCalendarEvent(access.accessToken, access.calendarId, existingEventId, {
      summary: eventPayload.summary,
      description: eventPayload.description,
      start: { dateTime: eventPayload.startIso, timeZone: eventPayload.timeZone },
      end: { dateTime: eventPayload.endIso, timeZone: eventPayload.timeZone },
      status: "confirmed",
    })
    if (patched) {
      return { ok: true, skipped: false, eventId: existingEventId }
    }
  }

  const createdId = await insertCalendarEvent(access.accessToken, access.calendarId, eventPayload)
  if (!createdId) {
    return { ok: false, error: "google_insert_failed" }
  }

  await persistBookingEventId(bookingId, createdId)
  return { ok: true, skipped: false, eventId: createdId }
}

/** Fire-and-forget — nigdy nie rzuca; nie loguje tokenów. */
export function queueGoogleCalendarBookingSync(bookingId: string, action: GoogleCalendarSyncAction): void {
  void syncBookingToGoogleCalendar(bookingId, action).catch(() => {
    /* ignoruj — integracja opcjonalna */
  })
}
