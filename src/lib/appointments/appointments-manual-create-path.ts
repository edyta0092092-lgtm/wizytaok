/** Query param — po wejściu na /appointments otwiera sheet ręcznej wizyty. */
export const APPOINTMENTS_MANUAL_CREATE_PARAM = "create"

export function appointmentsManualCreateHref(): string {
  return `/appointments?${APPOINTMENTS_MANUAL_CREATE_PARAM}=1`
}

export function isAppointmentsManualCreateIntent(searchParams: URLSearchParams): boolean {
  const value = searchParams.get(APPOINTMENTS_MANUAL_CREATE_PARAM)?.trim().toLowerCase()
  return value === "1" || value === "true" || value === "yes"
}
