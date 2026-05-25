/** Kroki setupu po aktywacji triala / płatności (kolejność produktowa). */

export const ONBOARDING_STEP_IDS = [
  "working_hours",
  "team_member",
  "service",
  "staff_service",
  "booking_page",
  "first_visit",
] as const

export type OnboardingStepId = (typeof ONBOARDING_STEP_IDS)[number]

export type OnboardingStepConfig = {
  id: OnboardingStepId
  /** Trasa panelu do rozpoczęcia kroku */
  path: string
  /** Element, który ma zostać przewinięty i podświetlony podczas aktywnego kroku. */
  targetSelector: string
  titleKey: string
  shortKey: string
  hintKey: string
}

export const ONBOARDING_STEPS: OnboardingStepConfig[] = [
  {
    id: "working_hours",
    path: "/availability",
    targetSelector: '[data-tour="availability-list"]',
    titleKey: "onboarding.steps.working_hours.title",
    shortKey: "onboarding.steps.working_hours.short",
    hintKey: "onboarding.steps.working_hours.hint",
  },
  {
    id: "team_member",
    path: "/team",
    targetSelector: '[data-tour="team-person-form"]',
    titleKey: "onboarding.steps.team_member.title",
    shortKey: "onboarding.steps.team_member.short",
    hintKey: "onboarding.steps.team_member.hint",
  },
  {
    id: "service",
    path: "/services",
    targetSelector: '[data-tour="services-form"]',
    titleKey: "onboarding.steps.service.title",
    shortKey: "onboarding.steps.service.short",
    hintKey: "onboarding.steps.service.hint",
  },
  {
    id: "staff_service",
    path: "/team",
    targetSelector: '[data-tour="team-staff-service-target"]',
    titleKey: "onboarding.steps.staff_service.title",
    shortKey: "onboarding.steps.staff_service.short",
    hintKey: "onboarding.steps.staff_service.hint",
  },
  {
    id: "booking_page",
    path: "/settings",
    targetSelector: '[data-tour="settings-company"]',
    titleKey: "onboarding.steps.booking_page.title",
    shortKey: "onboarding.steps.booking_page.short",
    hintKey: "onboarding.steps.booking_page.hint",
  },
  {
    id: "first_visit",
    path: "/appointments",
    targetSelector: '[data-tour="appointments-add"]',
    titleKey: "onboarding.steps.first_visit.title",
    shortKey: "onboarding.steps.first_visit.short",
    hintKey: "onboarding.steps.first_visit.hint",
  },
]

export function emptyOnboardingProgress(): Record<OnboardingStepId, boolean> {
  return {
    working_hours: false,
    team_member: false,
    service: false,
    staff_service: false,
    booking_page: false,
    first_visit: false,
  }
}

export function isOnboardingFullyComplete(
  progress: Record<OnboardingStepId, boolean>,
): boolean {
  return ONBOARDING_STEP_IDS.every((id) => progress[id])
}

export function firstIncompleteStepId(
  progress: Record<OnboardingStepId, boolean>,
): OnboardingStepId | null {
  for (const id of ONBOARDING_STEP_IDS) {
    if (!progress[id]) return id
  }
  return null
}

export function completedStepCount(progress: Record<OnboardingStepId, boolean>): number {
  return ONBOARDING_STEP_IDS.filter((id) => progress[id]).length
}

export function getStepConfig(id: OnboardingStepId): OnboardingStepConfig {
  const step = ONBOARDING_STEPS.find((s) => s.id === id)
  if (!step) throw new Error(`Unknown onboarding step: ${id}`)
  return step
}
