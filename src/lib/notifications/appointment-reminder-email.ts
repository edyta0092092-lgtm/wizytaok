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

/**
 * Wyciąga TYLKO pierwsze imię klienta — do użycia w powitaniach maila / SMS.
 *
 * Zasada projektowa (etap 1 e-mail i przyszły etap 2 SMS):
 *   - W powitaniach NIE używamy nazwiska klienta (UX / RODO),
 *     tylko pierwsze imię (a jeśli nie da się ustalić — bezosobowe „Dzień dobry,").
 *   - "Anna Kowalska"        → "Anna"
 *   - " Anna Kowalska "      → "Anna"
 *   - "Anna Maria Kowalska"  → "Anna"
 *   - "Kowalski"             → "Kowalski"   (jednoczłonowy zostaje, bo nie wiemy czy to imię)
 *   - ""                     → null
 *   - null / undefined       → null
 *
 * UWAGA dla przyszłej integracji SMS / SMSAPI:
 *   W treści SMS-a używaj WYŁĄCZNIE wartości zwróconej przez `getClientFirstName(...)`.
 *   Jeśli zwróci `null` — pomiń powitanie zupełnie, NIE wstawiaj nazwiska.
 */
export function getClientFirstName(
  fullName: string | null | undefined
): string | null {
  if (typeof fullName !== "string") return null
  const trimmed = fullName.trim()
  if (trimmed.length === 0) return null
  const first = trimmed.split(/\s+/)[0]
  return first && first.length > 0 ? first : null
}

export type AppointmentReminderEmailInput = {
  to: string
  businessName: string
  appointmentDate: string
  appointmentTime: string
  serviceName: string | null
  staffName: string | null
  clientName: string | null
  /**
   * Absolutny URL do istniejącej strony zarządzania wizytą (token-based),
   * np. `https://wizytaok.example/confirm/{confirmation_token}?source=reminder`.
   * Jeżeli null/pusty, sekcja z przyciskiem nie jest renderowana.
   * NIE jest to link do bezpośredniego anulowania — klient musi kliknąć
   * na stronie zarządzania, żeby potwierdzić obecność lub odwołać wizytę.
   */
  manageUrl?: string | null
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

  const { dateLabel, timeLabel, longLabel } = formatPolishAppointmentLabel(
    input.appointmentDate,
    input.appointmentTime
  )

  const businessNameRaw = input.businessName?.trim()
  const businessName = businessNameRaw && businessNameRaw.length > 0 ? businessNameRaw : "WizytaOK"
  const subject = "Przypomnienie o wizycie"
  const trimmedService = input.serviceName?.trim() || "wizyta"
  const appointmentDateTime = `${dateLabel}, ${timeLabel}`
  const trimmedManageUrl = input.manageUrl?.trim() || ""
  const hasManageLink = trimmedManageUrl.length > 0

  const detailRows: Array<{ label: string; value: string }> = [
    { label: "Usługa", value: trimmedService },
    { label: "Termin", value: appointmentDateTime },
  ]
  const trimmedStaff = input.staffName?.trim()
  if (trimmedStaff && trimmedStaff.length > 0) {
    detailRows.push({ label: "Osoba", value: trimmedStaff })
  }

  const text = [
    "Przypominamy o Twojej wizycie.",
    "",
    `Usługa: ${trimmedService}`,
    `Termin: ${appointmentDateTime}`,
    ...(hasManageLink
      ? [
          "",
          "Jeśli nie możesz przyjść, anuluj wizytę przez link:",
          trimmedManageUrl,
        ]
      : []),
    "",
    "Ta wiadomość została wysłana automatycznie przez WizytaOK.",
  ].join("\n")

  const preheader = `Przypominamy o wizycie — ${longLabel}.`

  const fontStack =
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"

  const detailRowsHtml = detailRows
    .map((row, idx) => {
      const topPadding = idx === 0 ? 0 : 18
      return `
                      <tr>
                        <td style="padding:${topPadding}px 0 0 0;">
                          <div style="font-family:${fontStack}; font-size:12px; line-height:1.4; color:#5b6d6a; text-transform:uppercase; letter-spacing:0.06em; font-weight:600;">${escapeHtml(row.label)}</div>
                          <div style="font-family:${fontStack}; font-size:16px; line-height:1.45; color:#0f1f1c; font-weight:600; margin-top:4px;">${escapeHtml(row.value)}</div>
                        </td>
                      </tr>`
    })
    .join("")

  const html = `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light" />
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0; padding:0; background-color:#F6FAF9; width:100%;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all; visibility:hidden; opacity:0; color:transparent; height:0; width:0;">${escapeHtml(preheader)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#F6FAF9;">
  <tr>
    <td align="center" style="padding:40px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;">
        <tr>
          <td style="padding:0 4px 18px 4px; font-family:${fontStack}; font-size:13px; line-height:1.3; color:#1f6b5d; letter-spacing:0.08em; text-transform:uppercase; font-weight:700;">
            WizytaOK
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff; border:1px solid #DDEDEA; border-radius:16px; padding:36px 32px;">
            <h1 style="margin:0 0 12px 0; font-family:${fontStack}; font-size:24px; line-height:1.3; color:#0f1f1c; font-weight:700;">
              Przypomnienie o wizycie
            </h1>
            <p style="margin:0 0 22px 0; font-family:${fontStack}; font-size:15px; line-height:1.6; color:#0f1f1c;">
              Przypominamy o Twojej wizycie.
            </p>
            <p style="margin:0 0 10px 0; font-family:${fontStack}; font-size:14px; line-height:1.4; color:#0f1f1c; font-weight:700;">
              Szczegóły:
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#F6FAF9; border:1px solid #DDEDEA; border-radius:12px;">
              <tr>
                <td style="padding:22px 24px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${detailRowsHtml}
                  </table>
                </td>
              </tr>
            </table>${
              hasManageLink
                ? `
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0 0;">
              <tr>
                <td align="center" style="background-color:#1f6b5d; border-radius:10px;">
                  <a href="${escapeHtml(trimmedManageUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block; padding:13px 26px; font-family:${fontStack}; font-size:15px; line-height:1.2; color:#ffffff; text-decoration:none; font-weight:600;">
                    Anuluj wizytę
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:10px 0 0 0; font-family:${fontStack}; font-size:13px; line-height:1.5; color:#5b6d6a;">
              Jeśli nie możesz przyjść, anuluj wizytę jak najwcześniej.
            </p>`
                : ""
            }
            <p style="margin:24px 0 0 0; font-family:${fontStack}; font-size:14px; line-height:1.55; color:#4a5b58;">
              Jeśli masz pytania lub chcesz zmienić termin, skontaktuj się bezpośrednio z firmą.
            </p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:20px 4px 0 4px; font-family:${fontStack}; font-size:12px; line-height:1.5; color:#7a8a87;">
            Ta wiadomość została wysłana automatycznie przez WizytaOK.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`

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
