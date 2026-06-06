"use client"

import {
  OnboardingPanel,
  useOnboardingPanelProgress,
} from "@/components/onboarding/onboarding-panel"
import {
  getStepConfig,
  isOnboardingFullyComplete,
  onboardingStepCount,
} from "@/lib/onboarding/onboarding-steps"
import { Card, CardContent } from "@/components/ui/card"
import { useOnboarding } from "@/lib/onboarding/onboarding-provider"
import { useTranslations } from "@/lib/i18n/use-translations"

export function OnboardingDashboardCard() {
  const { t } = useTranslations()
  const {
    isAdmin,
    showDashboardCard,
    flowActive,
    activeStepId,
    continueSetup,
    startSetupFromBeginning,
    skipForNow,
    snapshot,
  } = useOnboarding()
  const { loading, progress } = useOnboardingPanelProgress()

  if (!showDashboardCard) return null

  const { done, total } = onboardingStepCount(progress, isAdmin)
  const allDone = isOnboardingFullyComplete(progress, isAdmin)
  const showStartFromBeginning = done > 0 && !allDone
  const resumeStepId = snapshot?.record.meta.resumeStepId
  const cardLead = resumeStepId
    ? `${t("onboarding.cardLeadResumePrefix")} ${t(getStepConfig(resumeStepId).shortKey)}.`
    : t(isAdmin ? "onboarding.cardLead" : "onboarding.staffCardLead")

  return (
    <Card className="overflow-hidden rounded-2xl border border-primary/15 bg-card shadow-sm shadow-slate-900/[0.04]">
      <div className="h-1 w-full bg-gradient-to-r from-primary/80 via-primary/50 to-transparent" />
      <CardContent className="py-5 sm:py-6">
        <OnboardingPanel
          t={t}
          title={t(isAdmin ? "onboarding.cardTitle" : "onboarding.staffCardTitle")}
          lead={cardLead}
          loading={loading}
          progress={progress}
          activeStepId={activeStepId}
          flowActive={flowActive}
          onPrimary={() => void continueSetup()}
          onStartFromBeginning={() => void startSetupFromBeginning()}
          onSkip={() => skipForNow()}
          showStartFromBeginning={showStartFromBeginning}
          variant="card"
        />
      </CardContent>
    </Card>
  )
}
