import { Resend } from "resend"

const DEFAULT_FROM = "WizytaOK <no-reply@nordigital.pl>"

const POLISH_MONTHS = [
  "stycznia",
  "lutego",
  "marca",
  "kwietnia",
  "maja",
  "czerwca",
  "lipca",
  "sierpnia",
  "września",
  "października",
  "listopada",
  "grudnia",
] as const

/**
 * Format daty i godziny w Europe/Warsaw bez konwersji do strefy serwera.
 * Wejście: `appointment_date` (YYYY-MM-DD) + `appointment_time` (HH:MM:SS).
 */
export function formatPolishAppointmentLabel(
  appointmentDate: string,
  appointmentTime: string
): { dateLabel: string; timeLabel: string; longLabel: string } {
  const dateMatch = String(appointmentDate).trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  const timeMatch = String(appointmentTime).trim().match(/^(\d{1,2}):(\d{2})/)
  const year = dateMatch ? Number(dateMatch[1]) : NaN
  const month = dateMatch ? Number(dateMatch[2]) : NaN
  const day = dateMatch ? Number(dateMatch[3]) : NaN
  const hour = timeMatch ? Number(timeMatch[1]) : 0
  const minute = timeMatch ? Number(timeMatch[2]) : 0

  const dateLabel =
    Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day) && month >= 1 && month <= 12
      ? `${day} ${POLISH_MONTHS[month - 1]} ${year}`
      : appointmentDate
  const timeLabel = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
  const longLabel = `${dateLabel}, ${timeLabel}`
  return { dateLabel, timeLabel, longLabel }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export type AppointmentReminderEmailInput = {
  to: string
  businessName: string
  appointmentDate: string
  appointmentTime: string
  serviceName: string | null
  staffName: string | null
  clientName: string | null
  /** Adres kontaktowy firmy — używany jako reply_to, jeśli podany. */
  replyTo?: string | null
}

export type AppointmentReminderEmailResult =
  | { ok: true; provider: "resend"; messageId: string | null }
  | { ok: false; code: "not_configured" | "failed"; error: string }

/**
 * Wysyłka e-mail z przypomnieniem o wizycie przez Resend SDK.
 * Wymagane envy: `RESEND_API_KEY`. Nadawca: `REMINDERS_FROM_EMAIL` (fallback `RESEND_FROM`,
 * a w ostateczności default `WizytaOK <no-reply@nordigital.pl>`).
 */
export async function sendAppointmentReminderEmail(
  input: AppointmentReminderEmailInput
): Promise<AppointmentReminderEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) {
    return { ok: false, code: "not_configured", error: "RESEND_API_KEY not set" }
  }

  const from =
    process.env.REMINDERS_FROM_EMAIL?.trim() ||
    process.env.RESEND_FROM?.trim() ||
    DEFAULT_FROM

  const { dateLabel, timeLabel } = formatPolishAppointmentLabel(
    input.appointmentDate,
    input.appointmentTime
  )

  const subject = `Przypomnienie o wizycie — ${input.businessName}`
  const greetingName = (input.clientName ?? "").trim()
  const greetingLine = greetingName ? `Dzień dobry, ${greetingName}!` : "Dzień dobry!"

  const detailLines: string[] = [
    `Firma: ${input.businessName}`,
    `Data: ${dateLabel}`,
    `Godzina: ${timeLabel}`,
  ]
  if (input.serviceName && input.serviceName.trim().length > 0) {
    detailLines.push(`Usługa: ${input.serviceName.trim()}`)
  }
  if (input.staffName && input.staffName.trim().length > 0) {
    detailLines.push(`Specjalista: ${input.staffName.trim()}`)
  }

  const text = [
    greetingLine,
    "",
    "Przypominamy o nadchodzącej wizycie.",
    "",
    ...detailLines,
    "",
    "Do zobaczenia!",
    "",
    "—",
    "Ta wiadomość została wysłana automatycznie przez WizytaOK.",
  ].join("\n")

  const detailHtmlRows = detailLines
    .map((row) => {
      const colonIdx = row.indexOf(":")
      if (colonIdx === -1) return `<li>${escapeHtml(row)}</li>`
      const label = row.slice(0, colonIdx).trim()
      const value = row.slice(colonIdx + 1).trim()
      return `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</li>`
    })
    .join("")

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; line-height: 1.5; color: #111; max-width: 560px;">
  <p>${escapeHtml(greetingLine)}</p>
  <p>Przypominamy o nadchodzącej wizycie.</p>
  <ul style="padding-left: 18px; margin: 12px 0;">${detailHtmlRows}</ul>
  <p>Do zobaczenia!</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 18px 0;" />
  <p style="font-size: 12px; color: #666;">Ta wiadomość została wysłana automatycznie przez WizytaOK.</p>
</div>
  `.trim()

  const replyTo = input.replyTo?.trim() || undefined

  try {
    const resend = new Resend(apiKey)
    const result = await resend.emails.send({
      from,
      to: [input.to],
      subject,
      text,
      html,
      replyTo,
    })
    if (result.error) {
      return {
        ok: false,
        code: "failed",
        error: result.error.message || "resend_error",
      }
    }
    return {
      ok: true,
      provider: "resend",
      messageId: result.data?.id ?? null,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error"
    return { ok: false, code: "failed", error: message }
  }
}
