"use client"

import { usePathname } from "next/navigation"

import { Button } from "@/components/ui/button"
import { getStepConfig, type OnboardingStepId } from "@/lib/onboarding/onboarding-steps"
import { useOnboarding } from "@/lib/onboarding/onboarding-provider"
import { useTranslations } from "@/lib/i18n/use-translations"
import { cn } from "@/lib/utils"

const STEP_PATHS: Record<OnboardingStepId, string> = {
  working_hours: "/availability",
  team_member: "/team",
  service: "/services",
  staff_service: "/team",
  booking_page: "/settings",
  first_visit: "/appointments",
}

export function OnboardingFlowHint() {
  const { t } = useTranslations()
  const pathname = usePathname()
  const { flowActive, activeStepId, snapshot, continueSetup, skipForNow } = useOnboarding()

  if (!flowActive || !activeStepId || !snapshot) return null
  const stepPath = STEP_PATHS[activeStepId]
  if (!pathname.startsWith(stepPath)) return null
  if (snapshot.progress[activeStepId]) return null

  const step = getStepConfig(activeStepId)

  return (
    <div
      className={cn(
        "fixed bottom-4 left-4 right-4 z-[150] mx-auto max-w-md sm:left-auto sm:right-6",
      )}
    >
      <div className="rounded-2xl border border-border bg-card px-4 py-3 shadow-lg shadow-slate-900/10">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          {t("onboarding.flowBadge")}
        </p>
        <p className="mt-1 text-sm font-medium text-foreground">{t(step.titleKey)}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t(step.hintKey)}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" className="h-9 rounded-xl" onClick={() => continueSetup()}>
            {t("onboarding.flowNext")}
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-9" onClick={() => skipForNow()}>
            {t("onboarding.skipCard")}
          </Button>
        </div>
      </div>
    </div>
  )
}
