/** Kraje z walidacją długości numeru krajowego (cyfry po kierunkowym, format międzynarodowy). */
export type PhoneCountrySpec = {
  dialCode: string
  /** Kod ISO 3166-1 alpha-2 (PL, DE, …) — do etykiet UI obok numeru kierunkowego */
  labelKeySuffix: string
  nationalMin: number
  nationalMax: number
}

export const PHONE_COUNTRY_OPTIONS: PhoneCountrySpec[] = [
  { dialCode: "+48", labelKeySuffix: "PL", nationalMin: 9, nationalMax: 9 },
  { dialCode: "+49", labelKeySuffix: "DE", nationalMin: 10, nationalMax: 11 },
  { dialCode: "+44", labelKeySuffix: "GB", nationalMin: 10, nationalMax: 10 },
  { dialCode: "+33", labelKeySuffix: "FR", nationalMin: 9, nationalMax: 9 },
  { dialCode: "+39", labelKeySuffix: "IT", nationalMin: 9, nationalMax: 10 },
  { dialCode: "+34", labelKeySuffix: "ES", nationalMin: 9, nationalMax: 9 },
  { dialCode: "+420", labelKeySuffix: "CZ", nationalMin: 9, nationalMax: 9 },
  { dialCode: "+421", labelKeySuffix: "SK", nationalMin: 9, nationalMax: 9 },
  { dialCode: "+380", labelKeySuffix: "UA", nationalMin: 9, nationalMax: 9 },
  { dialCode: "+1", labelKeySuffix: "US", nationalMin: 10, nationalMax: 10 },
]

/** Etykieta opcji w selectcie telefonu, np. „PL +48”. */
export function formatPhoneCountryOptionLabel(spec: PhoneCountrySpec): string {
  return `${spec.labelKeySuffix} ${spec.dialCode}`
}

const SORTED_FOR_PARSE = [...PHONE_COUNTRY_OPTIONS].sort(
  (a, b) => b.dialCode.length - a.dialCode.length,
)

export function getPhoneCountrySpec(dialCode: string): PhoneCountrySpec {
  return PHONE_COUNTRY_OPTIONS.find((o) => o.dialCode === dialCode) ?? PHONE_COUNTRY_OPTIONS[0]!
}

/**
 * Rozbicie zapisanego numeru (np. z bazy) na kierunkowy i same cyfry krajowe.
 */
export function splitStoredPhoneIntoParts(raw: string | null | undefined): {
  dialCode: string
  nationalDigits: string
} {
  const DEFAULT_DIAL = "+48"
  const s = String(raw ?? "").trim()
  if (!s) return { dialCode: DEFAULT_DIAL, nationalDigits: "" }

  let rest = ""
  if (s.startsWith("+")) {
    rest = s.slice(1).replace(/[\s()-]/g, "")
  } else {
    const digits = s.replace(/\D/g, "")
    if (digits.startsWith("00") && digits.length > 2) {
      rest = digits.slice(2)
    } else {
      rest = digits
    }
  }

  if (!rest) return { dialCode: DEFAULT_DIAL, nationalDigits: "" }

  for (const opt of SORTED_FOR_PARSE) {
    const cd = opt.dialCode.slice(1)
    if (rest.startsWith(cd)) {
      return { dialCode: opt.dialCode, nationalDigits: rest.slice(cd.length) }
    }
  }

  if (rest.startsWith("48") && rest.length > 2) {
    return { dialCode: DEFAULT_DIAL, nationalDigits: rest.slice(2) }
  }

  return { dialCode: DEFAULT_DIAL, nationalDigits: rest }
}

/** Zapis do profilu (E.164 bez spacji). Pusty numer krajowy → pusty string. */
export function buildStoredInternationalPhone(dialCode: string, nationalRaw: string): string {
  const national = nationalRaw.replace(/\D/g, "")
  if (!national) return ""
  const dial = getPhoneCountrySpec(dialCode).dialCode
  return `${dial}${national}`
}

export function validateNationalPhoneLength(
  dialCode: string,
  nationalRaw: string,
): { ok: true } | { ok: false; min: number; max: number } {
  const national = nationalRaw.replace(/\D/g, "")
  if (!national) return { ok: true }
  const spec = getPhoneCountrySpec(dialCode)
  if (national.length < spec.nationalMin || national.length > spec.nationalMax) {
    return { ok: false, min: spec.nationalMin, max: spec.nationalMax }
  }
  return { ok: true }
}
