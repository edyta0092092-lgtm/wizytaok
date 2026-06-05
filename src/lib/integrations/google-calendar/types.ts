export type GoogleCalendarConnectionRow = {
  id: string
  business_id: string
  user_id: string
  business_member_id: string | null
  staff_member_id: string | null
  google_account_email: string | null
  google_calendar_id: string | null
  connected_at: string
  disconnected_at: string | null
  updated_at: string
}

export type GoogleCalendarConnectionStatus = {
  configured: boolean
  persistenceReady: boolean
  connected: boolean
  googleAccountEmail: string | null
  googleCalendarId: string | null
  connectedAt: string | null
  selectedCalendarSummary: string | null
}

export type GoogleCalendarListItem = {
  id: string
  summary: string
  primary: boolean
}

export type GoogleCalendarSyncAction = "upsert" | "cancel"

export type GoogleCalendarSyncResult =
  | { ok: true; skipped: true; reason: string }
  | { ok: true; skipped: false; eventId: string | null }
  | { ok: false; error: string }
