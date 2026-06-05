"use client"

import { Check } from "lucide-react"

import {
  completedStepCount,
  getOnboardingSteps,
  type OnboardingStepId,
} from "@/lib/onboarding/onboarding-steps"
import { useOnboarding } from "@/lib/onboarding/onboarding-provider"
import { cn } from "@/lib/utils"

type OnboardingStepListProps = {
  progress: Record<OnboardingStepId, boolean>
  activeStepId: OnboardingStepId | null
  t: (key: string) => string
}

export function OnboardingStepList({ progress, activeStepId, t }: OnboardingStepListProps) {
  const { isAdmin } = useOnboarding()
  const steps = getOnboardingSteps(isAdmin)

  return (
    <ul className="space-y-1.5" role="list">
      {steps.map((step) => {
        const done = progress[step.id]
        const active = activeStepId === step.id && !done
        return (
          <li
            key={step.id}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
              active && "bg-[color:var(--nav-active-bg)]",
              !active && !done && "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                done
                  ? "border-primary bg-primary text-primary-foreground"
                  : active
                    ? "border-primary text-primary"
                    : "border-border bg-background text-muted-foreground",
              )}
              aria-hidden
            >
              {done ? <Check className="size-3.5" strokeWidth={2.5} /> : null}
            </span>
            <span className={cn("min-w-0 flex-1 leading-snug", done && "text-foreground")}>
              {t(step.shortKey)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

export function onboardingStepCount(
  progress: Record<OnboardingStepId, boolean>,
  isAdmin: boolean,
): {
  done: number
  total: number
} {
  const total = getOnboardingSteps(isAdmin).length
  return {
    done: completedStepCount(progress, isAdmin),
    total,
  }
}
