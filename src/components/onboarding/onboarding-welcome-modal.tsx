"use client"

import { ArrowRight, X } from "lucide-react"

import { OnboardingProgressBar } from "@/components/onboarding/onboarding-progress"
import {
  onboardingStepCount,
  OnboardingStepList,
} from "@/components/onboarding/onboarding-step-list"
import {
  isOnboardingFullyComplete,
  onboardingPrimaryCtaKey,
} from "@/lib/onboarding/onboarding-steps"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { emptyOnboardingProgress } from "@/lib/onboarding/onboarding-steps"
import { useOnboarding } from "@/lib/onboarding/onboarding-provider"
import { useTranslations } from "@/lib/i18n/use-translations"

export function OnboardingWelcomeModal() {
  const { t } = useTranslations()
  const {
    isAdmin,
    welcomeOpen,
    eligible,
    loading,
    snapshot,
    flowActive,
    activeStepId,
    dismissWelcome,
    continueSetup,
    startSetupFromBeginning,
    skipForNow,
  } = useOnboarding()

  if (!eligible || !welcomeOpen) return null

  const progress = snapshot?.progress ?? emptyOnboardingProgress(isAdmin)
  const { done, total } = onboardingStepCount(progress, isAdmin)
  const allDone = isOnboardingFullyComplete(progress, isAdmin)
  const showStartFromBeginning = done > 0 && !allDone

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/45 p-4 pb-8 backdrop-blur-[2px] sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-welcome-title"
    >
      <Card className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 size-8 text-muted-foreground"
          onClick={() => dismissWelcome()}
          aria-label={t("onboarding.close")}
        >
          <X className="size-4" />
        </Button>
        <CardContent className="space-y-5 px-6 py-6 pt-8">
          <div className="space-y-2 pr-6">
            <h2 id="onboarding-welcome-title" className="text-xl font-semibold tracking-tight">
              {t(isAdmin ? "onboarding.welcomeTitle" : "onboarding.staffWelcomeTitle")}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t(isAdmin ? "onboarding.welcomeLead" : "onboarding.staffWelcomeLead")}
            </p>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">{t("onboarding.loading")}</p>
          ) : (
            <>
              <OnboardingProgressBar
                value={done}
                max={total}
                label={t("onboarding.progressLabel")}
              />
              <OnboardingStepList
                progress={progress}
                activeStepId={flowActive ? activeStepId : null}
                t={t}
                interactive
              />
            </>
          )}

          <div className="flex flex-col gap-2">
            <Button
              type="button"
              size="lg"
              className="h-11 rounded-xl"
              onClick={() => void continueSetup()}
              disabled={loading}
            >
              {t(onboardingPrimaryCtaKey(done, allDone))}
              <ArrowRight className="ml-2 size-4" />
            </Button>
            {showStartFromBeginning ? (
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl"
                onClick={() => startSetupFromBeginning()}
                disabled={loading}
              >
                {t("onboarding.startFromBeginningCta")}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => skipForNow()}
            >
              {t("onboarding.skipWelcome")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
