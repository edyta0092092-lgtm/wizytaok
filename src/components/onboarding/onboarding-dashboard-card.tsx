"use client"

import { ArrowRight, Sparkles } from "lucide-react"

import { OnboardingProgressBar } from "@/components/onboarding/onboarding-progress"
import {
  onboardingStepCount,
  OnboardingStepList,
} from "@/components/onboarding/onboarding-step-list"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { emptyOnboardingProgress, isOnboardingFullyComplete } from "@/lib/onboarding/onboarding-steps"
import { useOnboarding } from "@/lib/onboarding/onboarding-provider"
import { useTranslations } from "@/lib/i18n/use-translations"

export function OnboardingDashboardCard() {
  const { t } = useTranslations()
  const {
    showDashboardCard,
    loading,
    snapshot,
    flowActive,
    activeStepId,
    continueSetup,
    startSetupFromBeginning,
    skipForNow,
  } = useOnboarding()

  if (!showDashboardCard) return null

  const progress = snapshot?.progress ?? emptyOnboardingProgress()
  const { done, total } = onboardingStepCount(progress)
  const allDone = isOnboardingFullyComplete(progress)
  const showStartFromBeginning = done > 0 && !allDone

  return (
    <Card className="overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-[color:var(--nav-active-bg)] via-card to-card shadow-sm shadow-slate-900/5">
      <CardHeader className="space-y-1 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Sparkles className="size-4" aria-hidden />
          </span>
          <CardTitle className="text-base font-semibold">{t("onboarding.cardTitle")}</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">{t("onboarding.cardLead")}</p>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
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
            />
          </>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            className="h-11 flex-1 rounded-xl sm:min-w-[12rem]"
            onClick={() => continueSetup()}
            disabled={loading || allDone}
          >
            {allDone ? t("onboarding.allDone") : t("onboarding.continueCta")}
            {!allDone ? <ArrowRight className="ml-2 size-4" aria-hidden /> : null}
          </Button>
          {showStartFromBeginning ? (
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1 rounded-xl sm:min-w-[12rem]"
              onClick={() => startSetupFromBeginning()}
              disabled={loading}
            >
              {t("onboarding.startFromBeginningCta")}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            className="h-10 text-muted-foreground"
            onClick={() => skipForNow()}
          >
            {t("onboarding.skipCard")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
