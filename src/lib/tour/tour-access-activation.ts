/**
 * Welcome popup tylko po świeżej aktywacji dostępu (trial/płatność), nie przy pustym localStorage.
 * sessionStorage = jednorazowy sygnał „właśnie aktywowano”; localStorage per użytkownik + firma.
 */

export const ACCESS_ACTIVATION_SESSION_KEY = "pw_onboarding_access_just_activated"

const welcomeHandledPrefix = "pw_onboarding_welcome_handled_v2_"

export type AccessActivationMarker = {
  businessId: string
  at: number
}

export function welcomeHandledStorageKey(businessId: string, userId: string): string {
  return `${welcomeHandledPrefix}${userId.trim()}_${businessId.trim()}`
}

export function markPanelAccessJustActivated(businessId: string): void {
  const id = businessId.trim()
  if (!id || typeof window === "undefined") return
  try {
    const payload: AccessActivationMarker = { businessId: id, at: Date.now() }
    sessionStorage.setItem(ACCESS_ACTIVATION_SESSION_KEY, JSON.stringify(payload))
  } catch {
    /* ignore */
  }
}

export function readPanelAccessJustActivated(): AccessActivationMarker | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(ACCESS_ACTIVATION_SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object") return null
    const o = parsed as Record<string, unknown>
    const businessId = typeof o.businessId === "string" ? o.businessId.trim() : ""
    if (!businessId) return null
    const at = typeof o.at === "number" && Number.isFinite(o.at) ? o.at : Date.now()
    return { businessId, at }
  } catch {
    return null
  }
}

export function clearPanelAccessJustActivated(): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(ACCESS_ACTIVATION_SESSION_KEY)
  } catch {
    /* ignore */
  }
}

export function hasPendingAccessActivationForBusiness(businessId: string): boolean {
  const id = businessId.trim()
  if (!id) return false
  const marker = readPanelAccessJustActivated()
  return marker?.businessId === id
}

export function isWelcomeHandledForBusiness(businessId: string, userId: string): boolean {
  const bid = businessId.trim()
  const uid = userId.trim()
  if (!bid || !uid || typeof window === "undefined") return false
  try {
    return window.localStorage.getItem(welcomeHandledStorageKey(bid, uid)) === "1"
  } catch {
    return false
  }
}

export function markWelcomeHandledForBusiness(businessId: string, userId: string): void {
  const bid = businessId.trim()
  const uid = userId.trim()
  if (!bid || !uid || typeof window === "undefined") return
  try {
    window.localStorage.setItem(welcomeHandledStorageKey(bid, uid), "1")
  } catch {
    /* ignore */
  }
  clearPanelAccessJustActivated()
}
