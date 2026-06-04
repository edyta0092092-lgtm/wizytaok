import { getServiceRoleClient } from "@/lib/supabase/service-role"

export type ProvisionInviteeAuthResult =
  | { ok: true; userId: string; email: string; tempPassword: string | null; isNew: boolean }
  | { ok: false; error: string }

export type ProvisionInviteeAuthOptions = {
  /** Ustaw nowe hasło tymczasowe także dla istniejącego konta (ponowne wysłanie zaproszenia). */
  resetPasswordForExisting?: boolean
}

/** Hasło spełniające politykę rejestracji (min. 8 znaków, wielka litera, znak specjalny). */
export function generateStaffInviteTempPassword(): string {
  const chunk = crypto.randomUUID().replace(/-/g, "").slice(0, 10)
  return `A${chunk}#1`
}

async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const admin = getServiceRoleClient()
  if (!admin) return null
  const normalized = email.trim().toLowerCase()

  let page = 1
  const perPage = 200
  for (let i = 0; i < 10; i += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error || !data?.users?.length) break
    const hit = data.users.find((u) => (u.email ?? "").trim().toLowerCase() === normalized)
    if (hit?.id) return hit.id
    if (data.users.length < perPage) break
    page += 1
  }
  return null
}

export async function provisionInviteeAuthAccount(
  email: string,
  options: ProvisionInviteeAuthOptions = {},
): Promise<ProvisionInviteeAuthResult> {
  const admin = getServiceRoleClient()
  if (!admin) {
    return { ok: false, error: "supabase_unconfigured" }
  }

  const normalized = email.trim().toLowerCase()
  if (!normalized) {
    return { ok: false, error: "email_required" }
  }

  const tempPassword = generateStaffInviteTempPassword()
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: normalized,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      staff_invite: true,
      must_change_password: true,
    },
  })

  if (!createErr && created.user?.id) {
    return {
      ok: true,
      userId: created.user.id,
      email: normalized,
      tempPassword,
      isNew: true,
    }
  }

  const msg = createErr?.message?.toLowerCase() ?? ""
  const alreadyExists =
    msg.includes("already") ||
    msg.includes("registered") ||
    msg.includes("exists") ||
    msg.includes("duplicate")

  if (!alreadyExists) {
    return { ok: false, error: createErr?.message ?? "create_user_failed" }
  }

  const existingId = await findAuthUserIdByEmail(normalized)
  if (!existingId) {
    return { ok: false, error: "user_exists_but_not_found" }
  }

  if (options.resetPasswordForExisting) {
    const { error: updateErr } = await admin.auth.admin.updateUserById(existingId, {
      password: tempPassword,
      user_metadata: {
        staff_invite: true,
        must_change_password: true,
      },
    })
    if (updateErr) {
      return { ok: false, error: updateErr.message }
    }
    return {
      ok: true,
      userId: existingId,
      email: normalized,
      tempPassword,
      isNew: false,
    }
  }

  return {
    ok: true,
    userId: existingId,
    email: normalized,
    tempPassword: null,
    isNew: false,
  }
}
