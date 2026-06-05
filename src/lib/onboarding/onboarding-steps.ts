/** Kroki pierwszej konfiguracji — osobno dla administratora i obsługi. */

export const ONBOARDING_ADMIN_STEP_IDS = [
  "working_hours",
  "service",
  "team_member",
  "staff_service",
  "booking_page",
  "first_visit",
] as const

export const ONBOARDING_STAFF_STEP_IDS = [
  "staff_day_plan",
  "staff_appointments",
  "staff_first_visit",
  "staff_schedule",
  "staff_messages",
  "staff_guide",
] as const

export type AdminOnboardingStepId = (typeof ONBOARDING_ADMIN_STEP_IDS)[number]
export type StaffOnboardingStepId = (typeof ONBOARDING_STAFF_STEP_IDS)[number]
export type OnboardingStepId = AdminOnboardingStepId | StaffOnboardingStepId

export type OnboardingStepConfig = {
  id: OnboardingStepId
  path: string
  targetSelector: string
  titleKey: string
  shortKey: string
  hintKey: string
}

export const ONBOARDING_ADMIN_STEPS: OnboardingStepConfig[] = [
  {
    id: "working_hours",
    path: "/availability",
    targetSelector: '[data-tour="availability-list"]',
    titleKey: "onboarding.steps.working_hours.title",
    shortKey: "onboarding.steps.working_hours.short",
    hintKey: "onboarding.steps.working_hours.hint",
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
    id: "team_member",
    path: "/team",
    targetSelector: '[data-tour="team-person-form"]',
    titleKey: "onboarding.steps.team_member.title",
    shortKey: "onboarding.steps.team_member.short",
    hintKey: "onboarding.steps.team_member.hint",
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

export const ONBOARDING_STAFF_STEPS: OnboardingStepConfig[] = [
  {
    id: "staff_day_plan",
    path: "/dashboard",
    targetSelector: '[data-tour="dashboard-today"]',
    titleKey: "onboarding.steps.staff_day_plan.title",
    shortKey: "onboarding.steps.staff_day_plan.short",
    hintKey: "onboarding.steps.staff_day_plan.hint",
  },
  {
    id: "staff_appointments",
    path: "/appointments",
    targetSelector: '[data-tour="appointments-statuses"]',
    titleKey: "onboarding.steps.staff_appointments.title",
    shortKey: "onboarding.steps.staff_appointments.short",
    hintKey: "onboarding.steps.staff_appointments.hint",
  },
  {
    id: "staff_first_visit",
    path: "/appointments",
    targetSelector: '[data-tour="appointments-add"]',
    titleKey: "onboarding.steps.staff_first_visit.title",
    shortKey: "onboarding.steps.staff_first_visit.short",
    hintKey: "onboarding.steps.staff_first_visit.hint",
  },
  {
    id: "staff_schedule",
    path: "/schedule",
    targetSelector: '[data-tour="schedule-month"]',
    titleKey: "onboarding.steps.staff_schedule.title",
    shortKey: "onboarding.steps.staff_schedule.short",
    hintKey: "onboarding.steps.staff_schedule.hint",
  },
  {
    id: "staff_messages",
    path: "/messages",
    targetSelector: '[data-tour="messages-list"]',
    titleKey: "onboarding.steps.staff_messages.title",
    shortKey: "onboarding.steps.staff_messages.short",
    hintKey: "onboarding.steps.staff_messages.hint",
  },
  {
    id: "staff_guide",
    path: "/guide",
    targetSelector: '[data-tour="guide-intro"]',
    titleKey: "onboarding.steps.staff_guide.title",
    shortKey: "onboarding.steps.staff_guide.short",
    hintKey: "onboarding.steps.staff_guide.hint",
  },
]

/** @deprecated Użyj getOnboardingStepIds(isAdmin) */
export const ONBOARDING_STEP_IDS = ONBOARDING_ADMIN_STEP_IDS
/** @deprecated Użyj getOnboardingSteps(isAdmin) */
export const ONBOARDING_STEPS = ONBOARDING_ADMIN_STEPS

export function getOnboardingStepIds(isAdmin: boolean): readonly OnboardingStepId[] {
  return isAdmin ? ONBOARDING_ADMIN_STEP_IDS : ONBOARDING_STAFF_STEP_IDS
}

export function getOnboardingSteps(isAdmin: boolean): OnboardingStepConfig[] {
  return isAdmin ? ONBOARDING_ADMIN_STEPS : ONBOARDING_STAFF_STEPS
}

export function emptyOnboardingProgress(isAdmin: boolean): Record<OnboardingStepId, boolean> {
  const ids = getOnboardingStepIds(isAdmin)
  return Object.fromEntries(ids.map((id) => [id, false])) as Record<OnboardingStepId, boolean>
}

export function isOnboardingFullyComplete(
  progress: Record<OnboardingStepId, boolean>,
  isAdmin: boolean,
): boolean {
  return getOnboardingStepIds(isAdmin).every((id) => progress[id])
}

export function firstIncompleteStepId(
  progress: Record<OnboardingStepId, boolean>,
  isAdmin: boolean,
): OnboardingStepId | null {
  for (const id of getOnboardingStepIds(isAdmin)) {
    if (!progress[id]) return id
  }
  return null
}

export function completedStepCount(
  progress: Record<OnboardingStepId, boolean>,
  isAdmin: boolean,
): number {
  return getOnboardingStepIds(isAdmin).filter((id) => progress[id]).length
}

/** Klucz i18n głównego przycisku kreatora (start vs kontynuacja). */
export function onboardingPrimaryCtaKey(
  done: number,
  allDone: boolean,
): "onboarding.allDone" | "onboarding.startCta" | "onboarding.continueCta" {
  if (allDone) return "onboarding.allDone"
  if (done === 0) return "onboarding.startCta"
  return "onboarding.continueCta"
}

export function getStepConfig(id: OnboardingStepId): OnboardingStepConfig {
  const step =
    ONBOARDING_ADMIN_STEPS.find((s) => s.id === id) ??
    ONBOARDING_STAFF_STEPS.find((s) => s.id === id)
  if (!step) throw new Error(`Unknown onboarding step: ${id}`)
  return step
}

export function getStepPath(id: OnboardingStepId): string {
  return getStepConfig(id).path
}
