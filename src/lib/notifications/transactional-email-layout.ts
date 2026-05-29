export type TransactionalEmailDetailRow = {
  label: string
  value: string
}

export type TransactionalEmailCta = {
  href: string
  label: string
  hint?: string
}

export type BuildTransactionalEmailInput = {
  lang?: "pl" | "en"
  subject: string
  preheader: string
  title: string
  intro: string
  detailsHeading?: string
  detailRows: TransactionalEmailDetailRow[]
  cta?: TransactionalEmailCta | null
  extraParagraph?: string | null
  footerNote?: string | null
}

const FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"

const BRAND_GREEN = "#1f6b5d"

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function defaultFooter(lang: "pl" | "en"): string {
  return lang === "en"
    ? "This message was sent automatically by WizytaOK."
    : "Ta wiadomość została wysłana automatycznie przez WizytaOK."
}

function defaultDetailsHeading(lang: "pl" | "en"): string {
  return lang === "en" ? "Details:" : "Szczegóły:"
}

export function buildTransactionalEmailText(input: {
  intro: string
  detailRows: TransactionalEmailDetailRow[]
  cta?: TransactionalEmailCta | null
  footerNote?: string | null
  lang?: "pl" | "en"
}): string {
  const lang = input.lang ?? "pl"
  const lines = [
    input.intro,
    "",
    ...input.detailRows.map((row) => `${row.label}: ${row.value}`),
  ]
  const href = input.cta?.href?.trim() ?? ""
  if (href) {
    if (input.cta?.hint?.trim()) {
      lines.push("", input.cta.hint.trim())
    }
    lines.push("", `${input.cta?.label?.trim() || (lang === "en" ? "Open link" : "Otwórz link")}:`, href)
  }
  lines.push("", input.footerNote ?? defaultFooter(lang))
  return lines.join("\n")
}

/**
 * Owija dowolny, wolny tekst szablonu (np. własna treść użytkownika) w tę samą
 * brandowaną „kopertę" co pozostałe maile transakcyjne: tło, nagłówek WizytaOK,
 * biała karta i stopka. Dzięki temu maile z edytowalnych szablonów wyglądają
 * spójnie zamiast renderować się jako goły tekst.
 */
function inferCtaLabel(url: string, lang: "pl" | "en"): string {
  const u = url.toLowerCase()
  if (/\/rezerwacje\/|\/rezerwacja|book|booking/.test(u)) {
    return lang === "en" ? "Book a visit" : "Umów wizytę"
  }
  if (/\/confirm\/|confirm|potwierdz|anuluj|cancel|manage|zarz[aą]dz/.test(u)) {
    return lang === "en" ? "Manage visit" : "Zarządzaj wizytą"
  }
  return lang === "en" ? "Open" : "Otwórz"
}

function ctaButtonHtml(url: string, label: string): string {
  const safeHref = url.replace(/"/g, "%22")
  return `
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 16px 0;">
              <tr>
                <td align="center" style="background-color:${BRAND_GREEN}; border-radius:10px;">
                  <a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="display:inline-block; padding:13px 26px; font-family:${FONT_STACK}; font-size:15px; line-height:1.2; color:#ffffff; text-decoration:none; font-weight:600;">${escapeHtml(label)}</a>
                </td>
              </tr>
            </table>`
}

function linkifyInline(raw: string): string {
  const parts = raw.split(/(https?:\/\/[^\s<]+)/g)
  return parts
    .map((part, idx) => {
      if (idx % 2 === 1) {
        const safeHref = part.replace(/"/g, "%22")
        return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="color:${BRAND_GREEN}; text-decoration:underline; word-break:break-all;">${escapeHtml(part)}</a>`
      }
      return escapeHtml(part)
    })
    .join("")
}

export function buildBrandedBodyEmailHtml(
  body: string,
  opts?: { subject?: string; preheader?: string; footerNote?: string; lang?: "pl" | "en" },
): string {
  const lang = opts?.lang ?? "pl"
  const normalized = body.replace(/\r\n/g, "\n").trim()
  if (!normalized) return ""
  // Renderuj treść linia po linii: samodzielny link w osobnej linii → przycisk,
  // a linki w tekście → klikalne odnośniki. Puste linie rozdzielają akapity.
  const urlOnly = /^https?:\/\/\S+$/
  const blocks: string[] = []
  let para: string[] = []
  const flushPara = () => {
    if (para.length === 0) return
    const inner = para.map(linkifyInline).join("<br/>")
    blocks.push(
      `<p style="margin:0 0 16px 0; font-family:${FONT_STACK}; font-size:15px; line-height:1.6; color:#0f1f1c;">${inner}</p>`,
    )
    para = []
  }
  for (const rawLine of normalized.split("\n")) {
    const trimmed = rawLine.trim()
    if (trimmed === "") {
      flushPara()
      continue
    }
    if (urlOnly.test(trimmed)) {
      flushPara()
      blocks.push(ctaButtonHtml(trimmed, inferCtaLabel(trimmed, lang)))
      continue
    }
    para.push(rawLine)
  }
  flushPara()
  const paragraphsHtml = blocks.join("")
  const subject = opts?.subject?.trim() || "WizytaOK"
  const preheader = opts?.preheader?.trim() || normalized.replace(/\s+/g, " ").slice(0, 120)
  const footerNote = opts?.footerNote ?? defaultFooter(lang)

  return `<!doctype html>
<html lang="${lang}">
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
          <td style="padding:0 4px 18px 4px; font-family:${FONT_STACK}; font-size:13px; line-height:1.3; color:${BRAND_GREEN}; letter-spacing:0.08em; text-transform:uppercase; font-weight:700;">
            WizytaOK
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff; border:1px solid #DDEDEA; border-radius:16px; padding:36px 32px;">
            ${paragraphsHtml}
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:20px 4px 0 4px; font-family:${FONT_STACK}; font-size:12px; line-height:1.5; color:#7a8a87;">
            ${escapeHtml(footerNote)}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`
}

export function buildTransactionalEmailHtml(input: BuildTransactionalEmailInput): string {
  const lang = input.lang ?? "pl"
  const detailsHeading = input.detailsHeading ?? defaultDetailsHeading(lang)
  const footerNote = input.footerNote ?? defaultFooter(lang)
  const trimmedCtaHref = input.cta?.href?.trim() ?? ""
  const hasCta = trimmedCtaHref.length > 0 && Boolean(input.cta?.label?.trim())

  const detailRowsHtml = input.detailRows
    .map((row, idx) => {
      const topPadding = idx === 0 ? 0 : 18
      return `
                      <tr>
                        <td style="padding:${topPadding}px 0 0 0;">
                          <div style="font-family:${FONT_STACK}; font-size:12px; line-height:1.4; color:#5b6d6a; text-transform:uppercase; letter-spacing:0.06em; font-weight:600;">${escapeHtml(row.label)}</div>
                          <div style="font-family:${FONT_STACK}; font-size:16px; line-height:1.45; color:#0f1f1c; font-weight:600; margin-top:4px;">${escapeHtml(row.value)}</div>
                        </td>
                      </tr>`
    })
    .join("")

  const ctaHtml = hasCta
    ? `
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0 0;">
              <tr>
                <td align="center" style="background-color:${BRAND_GREEN}; border-radius:10px;">
                  <a href="${escapeHtml(trimmedCtaHref)}" target="_blank" rel="noopener noreferrer" style="display:inline-block; padding:13px 26px; font-family:${FONT_STACK}; font-size:15px; line-height:1.2; color:#ffffff; text-decoration:none; font-weight:600;">
                    ${escapeHtml(input.cta!.label)}
                  </a>
                </td>
              </tr>
            </table>${
              input.cta?.hint
                ? `
            <p style="margin:10px 0 0 0; font-family:${FONT_STACK}; font-size:13px; line-height:1.5; color:#5b6d6a;">
              ${escapeHtml(input.cta.hint)}
            </p>`
                : ""
            }`
    : ""

  const extraParagraphHtml = input.extraParagraph?.trim()
    ? `
            <p style="margin:24px 0 0 0; font-family:${FONT_STACK}; font-size:14px; line-height:1.55; color:#4a5b58;">
              ${escapeHtml(input.extraParagraph.trim())}
            </p>`
    : ""

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light" />
<title>${escapeHtml(input.subject)}</title>
</head>
<body style="margin:0; padding:0; background-color:#F6FAF9; width:100%;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all; visibility:hidden; opacity:0; color:transparent; height:0; width:0;">${escapeHtml(input.preheader)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#F6FAF9;">
  <tr>
    <td align="center" style="padding:40px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;">
        <tr>
          <td style="padding:0 4px 18px 4px; font-family:${FONT_STACK}; font-size:13px; line-height:1.3; color:${BRAND_GREEN}; letter-spacing:0.08em; text-transform:uppercase; font-weight:700;">
            WizytaOK
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff; border:1px solid #DDEDEA; border-radius:16px; padding:36px 32px;">
            <h1 style="margin:0 0 12px 0; font-family:${FONT_STACK}; font-size:24px; line-height:1.3; color:#0f1f1c; font-weight:700;">
              ${escapeHtml(input.title)}
            </h1>
            <p style="margin:0 0 22px 0; font-family:${FONT_STACK}; font-size:15px; line-height:1.6; color:#0f1f1c;">
              ${escapeHtml(input.intro)}
            </p>
            <p style="margin:0 0 10px 0; font-family:${FONT_STACK}; font-size:14px; line-height:1.4; color:#0f1f1c; font-weight:700;">
              ${escapeHtml(detailsHeading)}
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#F6FAF9; border:1px solid #DDEDEA; border-radius:12px;">
              <tr>
                <td style="padding:22px 24px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${detailRowsHtml}
                  </table>
                </td>
              </tr>
            </table>${ctaHtml}${extraParagraphHtml}
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:20px 4px 0 4px; font-family:${FONT_STACK}; font-size:12px; line-height:1.5; color:#7a8a87;">
            ${escapeHtml(footerNote)}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`
}
