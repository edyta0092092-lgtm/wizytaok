import type { PanelRole } from "@/lib/auth/permissions"
import type { Language } from "@/lib/i18n/dictionaries"
import { sendReminderEmail, type SendReminderEmailResult } from "@/lib/notifications/email"

export type SendBusinessInvitationEmailInput = {
  to: string
  businessName: string
  inviteUrl: string
  role: PanelRole
  inviteeName?: string
  language: Language
}

function roleLabel(role: PanelRole, language: Language): string {
  if (role === "admin") {
    return language === "en" ? "Administrator" : "Administrator"
  }
  return language === "en" ? "Staff" : "Obsługa"
}

function buildInvitationEmailContent(input: SendBusinessInvitationEmailInput): {
  subject: string
  textBody: string
  htmlBody: string
} {
  const { businessName, inviteUrl, role, inviteeName, language } = input
  const greetingName = inviteeName?.trim() || (language === "en" ? "there" : "")
  const roleText = roleLabel(role, language)

  if (language === "en") {
    const hello = inviteeName?.trim() ? `Hello ${inviteeName.trim()},` : "Hello,"
    const subject = `Invitation to ${businessName} panel — WizytaOK`
    const textBody = [
      hello,
      "",
      `You have been invited to join the ${businessName} team in WizytaOK.`,
      `Panel role: ${roleText}.`,
      "",
      "Open the link below to sign in or create an account and set your password:",
      inviteUrl,
      "",
      "If you did not expect this message, you can ignore it.",
      "",
      "— WizytaOK",
    ].join("\n")
    const htmlBody = `
<p>${hello}</p>
<p>You have been invited to join <strong>${escapeHtml(businessName)}</strong> in WizytaOK.</p>
<p>Panel role: <strong>${escapeHtml(roleText)}</strong>.</p>
<p><a href="${escapeHtml(inviteUrl)}">Accept invitation and open the panel</a></p>
<p style="color:#666;font-size:13px;">If the button does not work, copy this link:<br>${escapeHtml(inviteUrl)}</p>
<p style="color:#666;font-size:13px;">If you did not expect this message, you can ignore it.</p>
`.trim()
    return { subject, textBody, htmlBody }
  }

  const hello = greetingName ? `Cześć ${greetingName},` : "Cześć,"
  const subject = `Zaproszenie do panelu ${businessName} — WizytaOK`
  const textBody = [
    hello,
    "",
    `Zostałeś(-aś) zaproszony(-a) do zespołu firmy ${businessName} w WizytaOK.`,
    `Rola w panelu: ${roleText}.`,
    "",
    "Otwórz poniższy link, aby się zalogować lub utworzyć konto i ustawić hasło:",
    inviteUrl,
    "",
    "Jeśli nie spodziewałeś(-aś) się tej wiadomości, zignoruj ją.",
    "",
    "— WizytaOK",
  ].join("\n")
  const htmlBody = `
<p>${hello}</p>
<p>Zostałeś(-aś) zaproszony(-a) do zespołu firmy <strong>${escapeHtml(businessName)}</strong> w WizytaOK.</p>
<p>Rola w panelu: <strong>${escapeHtml(roleText)}</strong>.</p>
<p><a href="${escapeHtml(inviteUrl)}">Przyjmij zaproszenie i otwórz panel</a></p>
<p style="color:#666;font-size:13px;">Gdy link nie działa, skopiuj go do przeglądarki:<br>${escapeHtml(inviteUrl)}</p>
<p style="color:#666;font-size:13px;">Jeśli nie spodziewałeś(-aś) się tej wiadomości, zignoruj ją.</p>
`.trim()
  return { subject, textBody, htmlBody }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export async function sendBusinessInvitationEmail(
  input: SendBusinessInvitationEmailInput,
): Promise<SendReminderEmailResult> {
  const { subject, textBody, htmlBody } = buildInvitationEmailContent(input)
  return sendReminderEmail({
    to: input.to.trim(),
    subject,
    textBody,
    htmlBody,
  })
}
