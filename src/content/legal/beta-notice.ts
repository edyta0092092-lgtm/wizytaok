import { LEGAL_OPERATOR } from "@/content/legal/operator"

/** Komunikat operatora używany w miejscach wskazujących na dane prawne serwisu. */
export const LEGAL_OPERATOR_PUBLIC_NOTICE =
  `Operatorem serwisu ${LEGAL_OPERATOR.serviceName} jest ${LEGAL_OPERATOR.operatorName}. Kontakt: ${LEGAL_OPERATOR.contactEmail}.`

export const LEGAL_OPERATOR_PUBLIC_NOTICE_EN =
  `${LEGAL_OPERATOR.serviceName} is operated by ${LEGAL_OPERATOR.operatorName}. Contact: ${LEGAL_OPERATOR.contactEmail}.`

/** @deprecated Użyj LEGAL_OPERATOR_PUBLIC_NOTICE */
export const LEGAL_BETA_OPERATOR_PUBLIC_NOTICE = LEGAL_OPERATOR_PUBLIC_NOTICE

/** @deprecated Użyj LEGAL_OPERATOR_PUBLIC_NOTICE_EN */
export const LEGAL_BETA_OPERATOR_PUBLIC_NOTICE_EN = LEGAL_OPERATOR_PUBLIC_NOTICE_EN
