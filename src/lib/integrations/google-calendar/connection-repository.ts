import type { EncryptedTokenPayload } from "@/lib/integrations/google-calendar/token-crypto"
import type { GoogleCalendarConnectionRow } from "@/lib/integrations/google-calendar/types"
import { getServiceRoleClient } from "@/lib/supabase/service-role"

const TABLE = "google_calendar_connections"

type ConnectionRecord = GoogleCalendarConnectionRow & {
  refresh_token_ciphertext: string
  refresh_token_iv: string
  refresh_token_tag: string
}

export async function loadActiveConnectionForUser(
  businessId: string,
  userId: string,
): Promise<ConnectionRecord | null> {
  const admin = getServiceRoleClient()
  if (!admin) return null
  const { data, error } = await admin
    .from(TABLE as "business_members")
    .select("*")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .is("disconnected_at", null)
    .maybeSingle()
  if (error || !data) return null
  return data as unknown as ConnectionRecord
}

export async function loadConnectionForBookingStaff(
  businessId: string,
  staffId: string | null,
): Promise<ConnectionRecord | null> {
  const admin = getServiceRoleClient()
  if (!admin) return null

  if (staffId) {
    const { data: byStaff } = await admin
      .from(TABLE as "business_members")
      .select("*")
      .eq("business_id", businessId)
      .eq("staff_member_id", staffId)
      .is("disconnected_at", null)
      .not("google_calendar_id", "is", null)
      .limit(1)
      .maybeSingle()
    if (byStaff) return byStaff as unknown as ConnectionRecord
  }

  const { data: ownerMember } = await admin
    .from("business_members")
    .select("user_id")
    .eq("business_id", businessId)
    .eq("role", "admin")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle()

  if (ownerMember?.user_id) {
    return loadActiveConnectionForUser(businessId, ownerMember.user_id)
  }

  return null
}

export async function upsertConnection(input: {
  businessId: string
  userId: string
  businessMemberId: string
  staffMemberId: string | null
  googleAccountEmail: string | null
  encrypted: EncryptedTokenPayload
}): Promise<boolean> {
  const admin = getServiceRoleClient()
  if (!admin) return false
  const now = new Date().toISOString()
  const { error } = await admin.from(TABLE as "business_members").upsert(
    {
      business_id: input.businessId,
      user_id: input.userId,
      business_member_id: input.businessMemberId,
      staff_member_id: input.staffMemberId,
      google_account_email: input.googleAccountEmail,
      refresh_token_ciphertext: input.encrypted.ciphertext,
      refresh_token_iv: input.encrypted.iv,
      refresh_token_tag: input.encrypted.tag,
      connected_at: now,
      disconnected_at: null,
      updated_at: now,
    } as never,
    { onConflict: "business_id,user_id" },
  )
  return !error
}

export async function updateSelectedCalendar(
  businessId: string,
  userId: string,
  calendarId: string,
): Promise<boolean> {
  const admin = getServiceRoleClient()
  if (!admin) return false
  const { error } = await admin
    .from(TABLE as "business_members")
    .update({
      google_calendar_id: calendarId,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .is("disconnected_at", null)
  return !error
}

export async function disconnectConnection(businessId: string, userId: string): Promise<boolean> {
  const admin = getServiceRoleClient()
  if (!admin) return false
  const now = new Date().toISOString()
  const { error } = await admin
    .from(TABLE as "business_members")
    .update({
      disconnected_at: now,
      google_calendar_id: null,
      refresh_token_ciphertext: "",
      refresh_token_iv: "",
      refresh_token_tag: "",
      updated_at: now,
    } as never)
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .is("disconnected_at", null)
  return !error
}

export function connectionEncryptedPayload(row: ConnectionRecord): EncryptedTokenPayload {
  return {
    ciphertext: row.refresh_token_ciphertext,
    iv: row.refresh_token_iv,
    tag: row.refresh_token_tag,
  }
}
