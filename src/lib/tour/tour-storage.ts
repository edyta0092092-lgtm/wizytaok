/** Klucze localStorage onboardingu bez ruszania reszty aplikacji. */

export const TOUR_KEYS = {
  welcomeDismissed: "pw_onboarding_welcome_dismissed",
  tourFinished: "pw_onboarding_tour_completed",
  /** JSON: { active: boolean; stepIndex: number } — odporność na przeładowanie */
  tourState: "pw_onboarding_tour_state",
  checklist: "pw_guide_checklist_progress",
} as const

export type TourRuntimeState = {
  active: boolean
  stepIndex: number
}

export function readTourRuntimeState(): TourRuntimeState | null {
  try {
    const raw = window.localStorage.getItem(TOUR_KEYS.tourState)
    if (!raw) return null
    const p = JSON.parse(raw) as unknown
    if (!p || typeof p !== "object") return null
    const o = p as Record<string, unknown>
    if (typeof o.active !== "boolean" || typeof o.stepIndex !== "number") return null
    if (o.stepIndex < 0) return null
    return { active: o.active, stepIndex: Math.floor(o.stepIndex) }
  } catch {
    return null
  }
}

export function writeTourRuntimeState(state: TourRuntimeState | null) {
  try {
    if (!state || !state.active) {
      window.localStorage.removeItem(TOUR_KEYS.tourState)
      return
    }
    window.localStorage.setItem(
      TOUR_KEYS.tourState,
      JSON.stringify({ active: state.active, stepIndex: state.stepIndex })
    )
  } catch {
    /* ignore */
  }
}

export type ChecklistStatus = "todo" | "progress" | "done"

export type ChecklistProgress = Record<string, ChecklistStatus>

export function parseChecklistProgress(raw: string | null): ChecklistProgress {
  if (!raw) return {}
  try {
    const p = JSON.parse(raw) as unknown
    if (!p || typeof p !== "object") return {}
    return p as ChecklistProgress
  } catch {
    return {}
  }
}
