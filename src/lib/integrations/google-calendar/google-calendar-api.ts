import type { GoogleCalendarListItem } from "@/lib/integrations/google-calendar/types"

const API_BASE = "https://www.googleapis.com/calendar/v3"

export async function listGoogleCalendars(accessToken: string): Promise<GoogleCalendarListItem[]> {
  const res = await fetch(`${API_BASE}/users/me/calendarList?minAccessRole=writer`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return []
  const json = (await res.json()) as {
    items?: Array<{ id?: string; summary?: string; primary?: boolean }>
  }
  return (json.items ?? [])
    .filter((item) => item.id && item.summary)
    .map((item) => ({
      id: item.id!,
      summary: item.summary!,
      primary: Boolean(item.primary),
    }))
}

export type GoogleCalendarEventInput = {
  summary: string
  description: string
  startIso: string
  endIso: string
  timeZone: string
}

export async function insertCalendarEvent(
  accessToken: string,
  calendarId: string,
  event: GoogleCalendarEventInput,
): Promise<string | null> {
  const res = await fetch(
    `${API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: event.summary,
        description: event.description,
        start: { dateTime: event.startIso, timeZone: event.timeZone },
        end: { dateTime: event.endIso, timeZone: event.timeZone },
      }),
    },
  )
  if (!res.ok) return null
  const json = (await res.json()) as { id?: string }
  return typeof json.id === "string" ? json.id : null
}

export async function patchCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  patch: Record<string, unknown>,
): Promise<boolean> {
  const res = await fetch(
    `${API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(patch),
    },
  )
  return res.ok
}

export async function cancelCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
): Promise<boolean> {
  const res = await fetch(
    `${API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  )
  if (res.status === 404 || res.status === 410) return true
  return res.ok
}
