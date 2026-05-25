import { NextResponse } from "next/server"

import { safeInternalRedirect } from "@/lib/auth/safe-internal-redirect"
import {
  buildTransactionalEmailHtml,
  buildTransactionalEmailText,
} from "@/lib/notifications/transactional-email-layout"
import { sendReminderEmail } from "@/lib/notifications/email"
import { getServiceRoleClient } from "@/lib/supabase/service-role"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DEFAULT_NEXT_PATH = "/settings?setup=business"

type ResendConfirmationPayload = {
  email?: unknown
  next?: unknown
}

type GenerateMagicLinkResult = {
  data: {
    properties?: {
      action_link?: string
      hashed_token?: string
    }
  } | null
  error: { message?: string } | null
}

type GenerateLinkAuthAdmin = {
  generateLink: (params: {
    type: "magiclink"
    email: string
    options?: { redirectTo?: string }
  }) => Promise<GenerateMagicLinkResult>
}

function siteBaseFromRequest(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  const base = configured && configured.length > 0 ? configured : new URL(request.url).origin
  return base.replace(/\/$/, "")
}

function isUserNotFoundError(message: string | undefined): boolean {
  const m = (message ?? "").toLowerCase()
  return m.includes("not found") || m.includes("not exist")
}

export async function POST(request: Request) {
  let body: ResendConfirmationPayload
  try {
    body = (await request.json()) as ResendConfirmationPayload
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
  if (!email || email.length > 320 || !EMAIL_REGEX.test(email)) {
    return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 })
  }

  const nextPath = safeInternalRedirect(typeof body.next === "string" ? body.next : null) ?? DEFAULT_NEXT_PATH
  const siteBase = siteBaseFromRequest(request)
  const redirectTo = `${siteBase}/auth/confirm?next=${encodeURIComponent(nextPath)}`

  const admin = getServiceRoleClient()
  if (!admin) {
    return NextResponse.json({ ok: false, error: "service_role_missing" }, { status: 503 })
  }

  const authAdmin = admin.auth.admin as unknown as GenerateLinkAuthAdmin
  const generated = await authAdmin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  })

  if (generated.error) {
    if (isUserNotFoundError(generated.error.message)) {
      return NextResponse.json({ ok: true })
    }
    console.error("[resend-confirmation] generate link", generated.error.message)
    return NextResponse.json({ ok: false, error: "link_generation_failed" }, { status: 500 })
  }

  const tokenHash = generated.data?.properties?.hashed_token?.trim()
  const actionLink = generated.data?.properties?.action_link?.trim()
  const confirmationUrl = tokenHash
    ? `${siteBase}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=magiclink&next=${encodeURIComponent(nextPath)}`
    : actionLink

  if (!confirmationUrl) {
    console.error("[resend-confirmation] missing generated link")
    return NextResponse.json({ ok: false, error: "missing_link" }, { status: 500 })
  }

  const subject = "Potwierdź konto w WizytaOK"
  const intro =
    "Kliknij przycisk poniżej, aby potwierdzić adres e-mail i przejść dalej w konfiguracji konta."
  const ctaHint = "Jeśli przycisk nie działa, skopiuj link i wklej go w przeglądarce."
  const footerNote = "Jeśli nie zakładałaś konta w WizytaOK, zignoruj tę wiadomość."

  const textBody = buildTransactionalEmailText({
    intro,
    detailRows: [{ label: "Adres e-mail", value: email }],
    cta: {
      href: confirmationUrl,
      label: "Potwierdź adres e-mail",
      hint: ctaHint,
    },
    footerNote,
    lang: "pl",
  })

  const htmlBody = buildTransactionalEmailHtml({
    subject,
    preheader: "Potwierdź adres e-mail i dokończ konfigurację WizytaOK.",
    title: "Potwierdź adres e-mail",
    intro,
    detailsHeading: "Konto:",
    detailRows: [{ label: "Adres e-mail", value: email }],
    cta: {
      href: confirmationUrl,
      label: "Potwierdź adres e-mail",
      hint: ctaHint,
    },
    footerNote,
    lang: "pl",
  })

  const sent = await sendReminderEmail({
    to: email,
    subject,
    textBody,
    htmlBody,
  })

  if (!sent.ok) {
    console.error("[resend-confirmation] send email", sent.code, sent.error)
    return NextResponse.json({ ok: false, error: "email_send_failed" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
