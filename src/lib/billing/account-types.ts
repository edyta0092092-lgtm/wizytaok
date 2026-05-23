export const ACCOUNT_TYPE_REGISTERED = "registered_business" as const
export const ACCOUNT_TYPE_UNREGISTERED = "unregistered_activity" as const

export type BusinessAccountType =
  | typeof ACCOUNT_TYPE_REGISTERED
  | typeof ACCOUNT_TYPE_UNREGISTERED
