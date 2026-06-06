/** Publiczne dane operatora serwisu WizytaOK — używane w regulaminie i polityce prywatności. */
export const LEGAL_OPERATOR = {
  serviceName: "WizytaOK",
  operatorName: "Cronova",
  contactEmail: "kontakt@cronova.com.pl",
  privacyEmail: "kontakt@cronova.com.pl",
  serviceUrl: "https://wizytaok.pl",
  operatorWebsite: "https://www.cronova.com.pl",
  country: "Polska",
} as const

export const LEGAL_EFFECTIVE_DATE = "1 czerwca 2026 r."

export const LEGAL_VERSION_LABEL = `Obowiązuje od ${LEGAL_EFFECTIVE_DATE}`

export function legalOperatorBlock(): string {
  return `${LEGAL_OPERATOR.operatorName}, kontakt: ${LEGAL_OPERATOR.contactEmail}, strona serwisu: ${LEGAL_OPERATOR.serviceUrl}`
}
