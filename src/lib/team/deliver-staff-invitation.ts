import type { PanelRole } from "@/lib/auth/permissions"
import type { Language } from "@/lib/i18n/dictionaries"
import { getPublicAppOrigin } from "@/lib/notifications/public-app-origin"
import { acceptBusinessInvitationForUser } from "@/lib/team/business-invitation-public"
import { provisionInviteeAuthAccount } from "@/lib/team/provision-invitee-auth"
import { sendBusinessInvitationEmail } from "@/lib/team/send-business-invitation-email"

export type DeliverStaffInvitationInput = {
  token: string
  invitationEmail: string
  businessName: string
  role: PanelRole
  inviteeName?: string
  language: Language
  invitationStatus?: string
}

export type DeliverStaffInvitationOptions = {
  /** Powiąż konto z firmą (tylko gdy zaproszenie jest pending). */
  linkMembership?: boolean
  /** Wygeneruj nowe hasło tymczasowe w e-mailu. */
  resetPassword?: boolean
}

export type DeliverStaffInvitationResult =
  | {
      ok: true
      messageId?: string
      membershipLinked: boolean
      accountCreated: boolean
      membershipWarning?: string
    }
  | { ok: false; code?: string; error?: string }

export async function deliverStaffInvitation(
  input: DeliverStaffInvitationInput,
  options: DeliverStaffInvitationOptions = {},
): Promise<DeliverStaffInvitationResult> {
  const email = input.invitationEmail.trim().toLowerCase()
  const origin = getPublicAppOrigin()
  const token = input.token.trim()
  const acceptInviteUrl = `${origin}/accept-invite/${encodeURIComponent(token)}`
  const loginParams = new URLSearchParams({
    next: "/dashboard",
    email,
    invite: token,
  })
  const loginUrl = `${origin}/login?${loginParams.toString()}`
  /** Domyślnie bez resetu hasła — tylko pierwsze zaproszenie z jawnym resetPassword: true. */
  const resetPassword = options.resetPassword === true
  /** Członkostwo tylko po akceptacji linku — nie przy samym wysłaniu e-maila z panelu. */
  const linkMembership = options.linkMembership === true

  const provision = await provisionInviteeAuthAccount(email, {
    resetPasswordForExisting: resetPassword,
  })
  if (!provision.ok) {
    console.error("[deliver-staff-invitation] provision_failed", email, provision.error)
    return { ok: false, code: "provision_failed", error: provision.error }
  }

  const sendOut = await sendBusinessInvitationEmail({
    to: email,
    businessName: input.businessName,
    inviteUrl: acceptInviteUrl,
    loginUrl,
    loginEmail: email,
    tempPassword: provision.tempPassword,
    accountAlreadyExists: !provision.isNew && !provision.tempPassword,
    role: input.role,
    inviteeName: input.inviteeName,
    language: input.language,
  })

  if (!sendOut.ok) {
    console.error("[deliver-staff-invitation] email_failed", email, sendOut.code, sendOut.error)
    return {
      ok: false,
      code: sendOut.code,
      error: sendOut.error,
    }
  }

  let membershipLinked = false
  let membershipWarning: string | undefined
  if (linkMembership) {
    const acceptOut = await acceptBusinessInvitationForUser(
      input.token,
      provision.userId,
      email,
    )
    if (acceptOut.ok) {
      membershipLinked = true
    } else if (acceptOut.error === "already_used") {
      membershipLinked = true
    } else {
      console.error(
        "[deliver-staff-invitation] accept_after_email",
        email,
        acceptOut.error,
      )
      membershipWarning = acceptOut.error
    }
  }

  return {
    ok: true,
    messageId: sendOut.messageId,
    membershipLinked,
    accountCreated: provision.isNew,
    membershipWarning,
  }
}
