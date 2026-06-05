import type { SupabaseClient } from "@supabase/supabase-js"

export type BusinessMemberInvitationUpsert = {
  business_id: string
  user_id: string
  role: string
  email: string | null
  is_active?: boolean
  invited_by?: string | null
  staff_member_id?: string | null
  updated_at?: string
}

function isMissingColumnError(message: string, column: string): boolean {
  return message.toLowerCase().includes(column.toLowerCase())
}

/**
 * Upsert członkostwa z zaproszenia; pomija kolumny nieobecne w starszej bazie.
 */
export async function upsertBusinessMemberFromInvitation(
  admin: SupabaseClient,
  input: BusinessMemberInvitationUpsert,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let includeActive = input.is_active !== undefined
  let includeUpdatedAt = input.updated_at !== undefined
  let includeStaff = input.staff_member_id != null
  let includeInvited = input.invited_by != null

  while (true) {
    const row: Record<string, unknown> = {
      business_id: input.business_id,
      user_id: input.user_id,
      role: input.role,
      email: input.email,
    }
    if (includeActive && input.is_active !== undefined) {
      row.is_active = input.is_active
    }
    if (includeUpdatedAt && input.updated_at) {
      row.updated_at = input.updated_at
    }
    if (includeInvited && input.invited_by) {
      row.invited_by = input.invited_by
    }
    if (includeStaff && input.staff_member_id) {
      row.staff_member_id = input.staff_member_id
    }

    const { error } = await admin.from("business_members").upsert(row, {
      onConflict: "business_id,user_id",
    })
    if (!error) {
      return { ok: true }
    }

    const msg = error.message
    if (includeStaff && isMissingColumnError(msg, "staff_member_id")) {
      includeStaff = false
      continue
    }
    if (includeInvited && isMissingColumnError(msg, "invited_by")) {
      includeInvited = false
      continue
    }
    if (includeActive && isMissingColumnError(msg, "is_active")) {
      includeActive = false
      continue
    }
    if (includeUpdatedAt && isMissingColumnError(msg, "updated_at")) {
      includeUpdatedAt = false
      continue
    }

    return { ok: false, error: msg }
  }
}
