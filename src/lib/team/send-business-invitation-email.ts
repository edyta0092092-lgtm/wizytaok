import type { PanelRole } from "@/lib/auth/permissions"
import type { Language } from "@/lib/i18n/dictionaries"
import { sendReminderEmail, type SendReminderEmailResult } from "@/lib/notifications/email"
import {
  buildTransactionalEmailHtml,
  buildTransactionalEmailText,
} from "@/lib/notifications/transactional-email-layout"

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

/** „mysiaPYSIA PYSIA” → „Mysia Pysia” */
function formatInviteeDisplayName(raw: string | undefined): string | null {
  const trimmed = raw?.trim()
  if (!trimmed) return null
  return trimmed
    .split(/\s+/)
    .map((word) => {
      const lower = word.toLowerCase()
      if (!lower) return ""
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .filter(Boolean)
    .join(" ")
}

function buildInvitationEmailContent(input: SendBusinessInvitationEmailInput): {
  subject: string
  textBody: string
  htmlBody: string
} {
  const { businessName, inviteUrl, role, inviteeName, language } = input
  const lang = language === "en" ? "en" : "pl"
  const displayName = formatInviteeDisplayName(inviteeName)
  const roleText = roleLabel(role, lang)
  const business = businessName.trim() || "WizytaOK"

  if (lang === "en") {
    const subject = `Invitation to ${business} panel — WizytaOK`
    const title = "Panel invitation"
    const preheader = `Join the ${business} team in WizytaOK.`
    const intro = displayName
      ? `Hello ${displayName}, you have been invited to join the ${business} team in WizytaOK. Use the button below to sign in or create an account and set your password.`
      : `You have been invited to join the ${business} team in WizytaOK. Use the button below to sign in or create an account and set your password.`
    const detailRows = [
      { label: "Company", value: business },
      { label: "Panel role", value: roleText },
    ]
    const cta = {
      href: inviteUrl,
      label: "Accept invitation",
      hint: "If the button does not work, copy the link below into your browser.",
    }
    const extraParagraph = inviteUrl
    const footerNote = "If you did not expect this message, you can ignore it."

    return {
      subject,
      textBody: buildTransactionalEmailText({
        lang,
        intro,
        detailRows,
        cta,
        footerNote,
      }),
      htmlBody: buildTransactionalEmailHtml({
        lang,
        subject,
        preheader,
        title,
        intro,
        detailsHeading: "Invitation details",
        detailRows,
        cta,
        extraParagraph,
        footerNote,
      }),
    }
  }

  const subject = `Zaproszenie do panelu ${business} — WizytaOK`
  const title = "Zaproszenie do panelu"
  const preheader = `Dołącz do zespołu ${business} w WizytaOK.`
  const intro = displayName
    ? `Cześć ${displayName}, zapraszamy Cię do panelu zespołu firmy ${business} w WizytaOK. Kliknij przycisk poniżej, aby się zalogować lub utworzyć konto i ustawić hasło.`
    : `Zapraszamy Cię do panelu zespołu firmy ${business} w WizytaOK. Kliknij przycisk poniżej, aby się zalogować lub utworzyć konto i ustawić hasło.`
  const detailRows = [
    { label: "Firma", value: business },
    { label: "Rola w panelu", value: roleText },
  ]
  const cta = {
    href: inviteUrl,
    label: "Przyjmij zaproszenie",
    hint: "Gdy przycisk nie działa, skopiuj link poniżej i wklej go w przeglądarce.",
  }
  const extraParagraph = inviteUrl
  const footerNote = "Jeśli nie spodziewałeś(-aś) się tej wiadomości, zignoruj ją."

  return {
    subject,
    textBody: buildTransactionalEmailText({
      lang,
      intro,
      detailRows,
      cta,
      footerNote,
    }),
    htmlBody: buildTransactionalEmailHtml({
      lang,
      subject,
      preheader,
      title,
      intro,
      detailsHeading: "Szczegóły zaproszenia",
      detailRows,
      cta,
      extraParagraph,
      footerNote,
    }),
  }
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
