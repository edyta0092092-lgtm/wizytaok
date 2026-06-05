"use client"

import Link from "next/link"
import { ArrowRight, BookOpen } from "lucide-react"

import { OnboardingProgressBar } from "@/components/onboarding/onboarding-progress"
import { OnboardingStepRail } from "@/components/onboarding/onboarding-step-rail"
import {
  onboardingStepCount,
  onboardingPrimaryCtaKey,
  isOnboardingFullyComplete,
  emptyOnboardingProgress,
  type OnboardingStepId,
} from "@/lib/onboarding/onboarding-steps"
import { Button } from "@/components/ui/button"
import { useOnboarding } from "@/lib/onboarding/onboarding-provider"
import { cn } from "@/lib/utils"

type OnboardingPanelProps = {
  t: (key: string) => string
  title: string
  lead: string
  loading: boolean
  progress: Record<OnboardingStepId, boolean>
  activeStepId: OnboardingStepId | null
  flowActive: boolean
  onPrimary: () => void
  onStartFromBeginning?: () => void
  onSkip: () => void
  showStartFromBeginning: boolean
  variant?: "modal" | "card"
  className?: string
}

export function OnboardingPanel({
  t,
  title,
  lead,
  loading,
  progress,
  activeStepId,
  flowActive,
  onPrimary,
  onStartFromBeginning,
  onSkip,
  showStartFromBeginning,
  variant = "modal",
  className,
}: OnboardingPanelProps) {
  const { isAdmin, snapshot } = useOnboarding()
  const { done, total } = onboardingStepCount(progress, isAdmin)
  const allDone = isOnboardingFullyComplete(progress, isAdmin)
  const hasResumeStep = Boolean(snapshot?.record.meta.resumeStepId)

  return (
    <div className={cn("space-y-5", className)}>
      <div className="space-y-1.5">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-primary">
          {t(isAdmin ? "onboarding.badgeAdmin" : "onboarding.badgeStaff")}
        </p>
        <h2
          className={cn(
            "font-semibold tracking-tight text-foreground",
            variant === "modal" ? "text-xl" : "text-base",
          )}
        >
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{lead}</p>
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
          <OnboardingStepRail
            progress={progress}
            activeStepId={flowActive ? activeStepId : null}
            t={t}
            interactive
            compact={variant === "card"}
          />
        </>
      )}

      <div className="flex flex-col gap-2">
        <Button
          type="button"
          size="lg"
          className="h-11 w-full rounded-xl"
          onClick={() => onPrimary()}
          disabled={loading || allDone}
        >
          {t(onboardingPrimaryCtaKey(done, allDone, hasResumeStep))}
          {!allDone ? <ArrowRight className="ml-2 size-4" aria-hidden /> : null}
        </Button>
        {showStartFromBeginning && onStartFromBeginning ? (
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full rounded-xl"
            onClick={() => onStartFromBeginning()}
            disabled={loading}
          >
            {t("onboarding.startFromBeginningCta")}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          className="h-10 text-muted-foreground"
          onClick={() => onSkip()}
        >
          {variant === "modal" ? t("onboarding.skipWelcome") : t("onboarding.skipCard")}
        </Button>
      </div>

      <p className="flex items-start gap-2 border-t border-border/60 pt-4 text-xs text-muted-foreground">
        <BookOpen className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>
          {t("onboarding.helpCenterNote")}{" "}
          <Link href="/guide" className="font-medium text-primary underline-offset-4 hover:underline">
            {t("navigation.guide")}
          </Link>
        </span>
      </p>
    </div>
  )
}

export function useOnboardingPanelProgress() {
  const { isAdmin, snapshot, loading } = useOnboarding()
  return {
    loading,
    progress: snapshot?.progress ?? emptyOnboardingProgress(isAdmin),
  }
}
