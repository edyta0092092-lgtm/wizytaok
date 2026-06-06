import { NextResponse } from "next/server"

import {
  isGoogleCalendarOAuthConfigured,
  isGoogleCalendarTokenEncryptionConfigured,
} from "@/lib/integrations/google-calendar/config"
import { loadActiveConnectionForUser } from "@/lib/integrations/google-calendar/connection-repository"
import { requireGoogleCalendarMember } from "@/lib/integrations/google-calendar/member-auth"
import {
  isGoogleCalendarDatabaseReady,
  isGoogleCalendarPersistenceReady,
  isGoogleCalendarServiceRoleConfigured,
} from "@/lib/integrations/google-calendar/persistence-ready"
import type { GoogleCalendarConnectionStatus } from "@/lib/integrations/google-calendar/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  const auth = await requireGoogleCalendarMember()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const oauthConfigured = isGoogleCalendarOAuthConfigured()
  const encryptionConfigured = isGoogleCalendarTokenEncryptionConfigured()
  const serviceRoleConfigured = isGoogleCalendarServiceRoleConfigured()
  const databaseReady = await isGoogleCalendarDatabaseReady()
  const configured = oauthConfigured
  const persistenceReady = await isGoogleCalendarPersistenceReady()

  let status: GoogleCalendarConnectionStatus = {
    configured,
    persistenceReady,
    setup: {
      oauthConfigured,
      encryptionConfigured,
      serviceRoleConfigured,
      databaseReady,
    },
    connected: false,
    googleAccountEmail: null,
    googleCalendarId: null,
    connectedAt: null,
    selectedCalendarSummary: null,
  }

  if (persistenceReady) {
    const row = await loadActiveConnectionForUser(auth.ctx.businessId, auth.ctx.userId)
    if (row && row.google_calendar_id) {
      status = {
        ...status,
        connected: true,
        googleAccountEmail: row.google_account_email,
        googleCalendarId: row.google_calendar_id,
        connectedAt: row.connected_at,
        selectedCalendarSummary: row.google_calendar_summary ?? row.google_calendar_id,
      }
    } else if (row) {
      status = {
        ...status,
        connected: true,
        googleAccountEmail: row.google_account_email,
        googleCalendarId: null,
        connectedAt: row.connected_at,
        selectedCalendarSummary: null,
      }
    }
  }

  return NextResponse.json({ ok: true, status })
}
