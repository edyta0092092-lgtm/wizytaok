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
  loginUrl?: string
  loginEmail?: string
  tempPassword?: string | null
  accountAlreadyExists?: boolean
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
  const {
    businessName,
    inviteUrl,
    loginUrl,
    loginEmail,
    tempPassword,
    accountAlreadyExists,
    role,
    inviteeName,
    language,
  } = input
  const lang = language === "en" ? "en" : "pl"
  const displayName = formatInviteeDisplayName(inviteeName)
  const roleText = roleLabel(role, lang)
  const business = businessName.trim() || "WizytaOK"
  const emailLogin = (loginEmail ?? input.to).trim()
  const ctaHref = (loginUrl ?? inviteUrl).trim()
  const inviteLink = inviteUrl.trim()
  const loginLink = (loginUrl ?? inviteUrl).trim()
  const linkFooter =
    inviteLink && inviteLink !== loginLink
      ? lang === "en"
        ? `Sign in: ${loginLink}\nAccept invitation: ${inviteLink}`
        : `Logowanie: ${loginLink}\nLink zaproszenia: ${inviteLink}`
      : ctaHref
  const hasTempPassword = Boolean(tempPassword?.trim())

  const detailRows =
    lang === "en"
      ? [
          { label: "Company", value: business },
          { label: "Panel role", value: roleText },
          { label: "Login email", value: emailLogin },
          ...(hasTempPassword
            ? [{ label: "Temporary password", value: tempPassword!.trim() }]
            : []),
        ]
      : [
          { label: "Firma", value: business },
          { label: "Rola w panelu", value: roleText },
          { label: "E-mail logowania", value: emailLogin },
          ...(hasTempPassword
            ? [{ label: "Hasło tymczasowe", value: tempPassword!.trim() }]
            : []),
        ]

  const passwordNote =
    lang === "en"
      ? hasTempPassword
        ? "After signing in, change your password in account settings."
        : accountAlreadyExists
          ? "Use your existing WizytaOK password. If you forgot it, reset it on the login page."
          : null
      : hasTempPassword
        ? "Po zalogowaniu zmień hasło w ustawieniach konta."
        : accountAlreadyExists
          ? "Użyj dotychczasowego hasła do WizytaOK. Jeśli je zapomniałeś(-aś), zresetuj je na stronie logowania."
          : null

  if (lang === "en") {
    const subject = `Access to ${business} panel — WizytaOK`
    const title = "Your panel access"
    const preheader = `Login details for ${business} in WizytaOK.`
    const intro = displayName
      ? `Hello ${displayName}, you have been added to the ${business} team in WizytaOK. Sign in with the credentials below.`
      : `You have been added to the ${business} team in WizytaOK. Sign in with the credentials below.`
    const cta = {
      href: ctaHref,
      label: "Sign in to the panel",
      hint: "If the button does not work, copy the link below into your browser.",
    }

    return {
      subject,
      textBody: buildTransactionalEmailText({
        lang,
        intro,
        detailRows,
        cta,
        footerNote: passwordNote ?? undefined,
      }),
      htmlBody: buildTransactionalEmailHtml({
        lang,
        subject,
        preheader,
        title,
        intro,
        detailsHeading: "Login details",
        detailRows,
        cta,
        extraParagraph: linkFooter,
        footerNote: passwordNote ?? "This message was sent automatically by WizytaOK.",
      }),
    }
  }

  const subject = `Dostęp do panelu ${business} — WizytaOK`
  const title = "Dostęp do panelu"
  const preheader = `Dane logowania do ${business} w WizytaOK.`
  const intro = displayName
    ? `Cześć ${displayName}, zostałaś dodana do zespołu firmy ${business} w WizytaOK. Zaloguj się poniższymi danymi.`
    : `Zostałaś dodana do zespołu firmy ${business} w WizytaOK. Zaloguj się poniższymi danymi.`
  const cta = {
    href: ctaHref,
    label: "Zaloguj się do panelu",
    hint: "Gdy przycisk nie działa, skopiuj link poniżej i wklej go w przeglądarce.",
  }

  return {
    subject,
    textBody: buildTransactionalEmailText({
      lang,
      intro,
      detailRows,
      cta,
      footerNote: passwordNote ?? undefined,
    }),
    htmlBody: buildTransactionalEmailHtml({
      lang,
      subject,
      preheader,
      title,
      intro,
      detailsHeading: "Dane logowania",
      detailRows,
      cta,
      extraParagraph: linkFooter,
      footerNote: passwordNote ?? "Ta wiadomość została wysłana automatycznie przez WizytaOK.",
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
