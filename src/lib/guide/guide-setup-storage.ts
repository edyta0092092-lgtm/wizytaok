import type { GuideSetupStepId } from "@/lib/guide/fetch-guide-setup"

export const GUIDE_SETUP_MANUAL_KEY = "wizytaok-guide-setup-progress"

export type GuideSetupManual = Partial<Record<GuideSetupStepId, boolean>>

export function parseGuideSetupManual(raw: string | null): GuideSetupManual {
  if (!raw) return {}
  try {
    const p = JSON.parse(raw) as unknown
    if (!p || typeof p !== "object") return {}
    const next: GuideSetupManual = {}
    for (const [key, value] of Object.entries(p as Record<string, unknown>)) {
      if (value === true || value === false) {
        next[key as GuideSetupStepId] = value
      }
    }
    return next
  } catch {
    return {}
  }
}

export function writeGuideSetupManual(next: GuideSetupManual) {
  try {
    window.localStorage.setItem(GUIDE_SETUP_MANUAL_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}
