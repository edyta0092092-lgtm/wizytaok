type TranslateFn = (key: string) => string

function dictReason(t: TranslateFn, code: string): string | null {
  const dictKey = `messagesLog.deliveryErrorReason.${code}`
  const translated = t(dictKey)
  return translated !== dictKey ? translated : null
}

function matchProviderMessage(raw: string, t: TranslateFn, language: "pl" | "en"): string | null {
  if (language !== "pl") return null
  const lower = raw.toLowerCase()

  if (lower.includes("not enough credits") || lower.includes("top up your account")) {
    return dictReason(t, "smsapi_insufficient_credits")
  }
  if (
    lower.includes("recipient number is currently unsupported") ||
    lower.includes("unsupported number") ||
    lower.includes("number is unsupported")
  ) {
    return dictReason(t, "smsapi_unsupported_number")
  }
  if (lower.includes("invalid number") || lower.includes("invalid phone")) {
    return dictReason(t, "invalid_phone")
  }
  if (lower.includes("smsapi_token not set") || lower.includes("token not set")) {
    return dictReason(t, "not_configured")
  }
  if (lower.includes("empty_message")) {
    return dictReason(t, "empty_message")
  }
  if (lower.startsWith("http_")) {
    return dictReason(t, "provider_http_error")
  }
  if (lower.startsWith("rejected")) {
    const inner = raw.replace(/^Rejected\s*\((.*)\)\s*$/i, "$1").trim()
    if (inner && inner !== raw) {
      const innerTranslated = matchProviderMessage(inner, t, language)
      if (innerTranslated) return innerTranslated
    }
    return dictReason(t, "smsapi_rejected")
  }

  return null
}

/** Czytelny opis błędu/pominięcia wysyłki (PL/EN) z kodu lub komunikatu dostawcy. */
export function formatDeliveryError(
  raw: string,
  t: TranslateFn,
  language: "pl" | "en",
): string {
  const trimmed = raw.trim()
  if (!trimmed) return trimmed

  const code = trimmed.split(":")[0]?.trim() ?? trimmed
  const fromDict = dictReason(t, code)
  if (fromDict) return fromDict

  if (trimmed === "Missing client contact details") {
    return t("notifications.failureReasonMissingPhone")
  }

  const fromPattern = matchProviderMessage(trimmed, t, language)
  if (fromPattern) return fromPattern

  return trimmed
}
