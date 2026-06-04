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
}

export type DeliverStaffInvitationResult =
  | { ok: true; messageId?: string; membershipLinked: boolean; accountCreated: boolean }
  | { ok: false; code?: string; error?: string }

export async function deliverStaffInvitation(
  input: DeliverStaffInvitationInput,
): Promise<DeliverStaffInvitationResult> {
  const email = input.invitationEmail.trim().toLowerCase()
  const origin = getPublicAppOrigin()
  const loginUrl = `${origin}/login?next=${encodeURIComponent("/dashboard")}&email=${encodeURIComponent(email)}`

  const provision = await provisionInviteeAuthAccount(email)
  if (!provision.ok) {
    return { ok: false, code: "provision_failed", error: provision.error }
  }

  let membershipLinked = false
  const acceptOut = await acceptBusinessInvitationForUser(
    input.token,
    provision.userId,
    email,
  )
  if (acceptOut.ok) {
    membershipLinked = true
  } else if (acceptOut.error !== "already_used") {
    return { ok: false, code: acceptOut.error, error: acceptOut.error }
  } else {
    membershipLinked = true
  }

  const sendOut = await sendBusinessInvitationEmail({
    to: email,
    businessName: input.businessName,
    inviteUrl: loginUrl,
    loginUrl,
    loginEmail: email,
    tempPassword: provision.tempPassword,
    accountAlreadyExists: !provision.isNew,
    role: input.role,
    inviteeName: input.inviteeName,
    language: input.language,
  })

  if (!sendOut.ok) {
    return {
      ok: false,
      code: sendOut.code,
      error: sendOut.error,
    }
  }

  return {
    ok: true,
    messageId: sendOut.messageId,
    membershipLinked,
    accountCreated: provision.isNew,
  }
}
