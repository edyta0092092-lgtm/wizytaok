import type { User } from "@supabase/supabase-js"

export function isStaffInviteUser(user: User | null | undefined): boolean {
  const raw = user?.user_metadata?.staff_invite
  return raw === true || raw === "true" || raw === 1 || raw === "1"
}
