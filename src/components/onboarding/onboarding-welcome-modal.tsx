"use client"

import { X } from "lucide-react"

import {
  OnboardingPanel,
  useOnboardingPanelProgress,
} from "@/components/onboarding/onboarding-panel"
import {
  isOnboardingFullyComplete,
  onboardingStepCount,
} from "@/lib/onboarding/onboarding-steps"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useOnboarding } from "@/lib/onboarding/onboarding-provider"
import { useTranslations } from "@/lib/i18n/use-translations"

export function OnboardingWelcomeModal() {
  const { t } = useTranslations()
  const {
    isAdmin,
    welcomeOpen,
    eligible,
    flowActive,
    activeStepId,
    dismissWelcome,
    continueSetup,
    startSetupFromBeginning,
    skipForNow,
  } = useOnboarding()
  const { loading, progress } = useOnboardingPanelProgress()

  if (!eligible || !welcomeOpen) return null

  const { done, total } = onboardingStepCount(progress, isAdmin)
  const allDone = isOnboardingFullyComplete(progress, isAdmin)
  const showStartFromBeginning = done > 0 && !allDone

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 p-4 pb-6 backdrop-blur-[3px] sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-welcome-title"
    >
      <Card className="relative w-full max-w-lg rounded-2xl border border-border/80 bg-card shadow-2xl">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 z-10 size-8 text-muted-foreground"
          onClick={() => dismissWelcome()}
          aria-label={t("onboarding.close")}
        >
          <X className="size-4" />
        </Button>
        <CardContent className="px-6 py-6 pt-8">
          <OnboardingPanel
            t={t}
            title={t(isAdmin ? "onboarding.welcomeTitle" : "onboarding.staffWelcomeTitle")}
            lead={t(isAdmin ? "onboarding.welcomeLead" : "onboarding.staffWelcomeLead")}
            loading={loading}
            progress={progress}
            activeStepId={activeStepId}
            flowActive={flowActive}
            onPrimary={() => void continueSetup()}
            onStartFromBeginning={() => void startSetupFromBeginning()}
            onSkip={() => skipForNow()}
            showStartFromBeginning={showStartFromBeginning}
            variant="modal"
          />
        </CardContent>
      </Card>
    </div>
  )
}
