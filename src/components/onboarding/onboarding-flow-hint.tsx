"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { ArrowRight, Check } from "lucide-react"

import { Button } from "@/components/ui/button"
import { getOnboardingStepIndex, getStepConfig } from "@/lib/onboarding/onboarding-steps"
import { useOnboarding } from "@/lib/onboarding/onboarding-provider"
import { useTranslations } from "@/lib/i18n/use-translations"
import { cn } from "@/lib/utils"

type HighlightRect = {
  top: number
  left: number
  width: number
  height: number
}

export function OnboardingFlowHint() {
  const { t } = useTranslations()
  const pathname = usePathname()
  const {
    isAdmin,
    flowActive,
    activeStepId,
    snapshot,
    advanceFlowStep,
    skipForNow,
  } = useOnboarding()
  const [highlightRect, setHighlightRect] = React.useState<HighlightRect | null>(null)
  const [advancing, setAdvancing] = React.useState(false)

  const stepPath = activeStepId ? getStepConfig(activeStepId).path : null
  const stepDone = Boolean(activeStepId && snapshot?.progress[activeStepId])
  const canShowStep =
    Boolean(flowActive && activeStepId && snapshot && stepPath && pathname.startsWith(stepPath))

  React.useEffect(() => {
    if (canShowStep) return
    queueMicrotask(() => setHighlightRect(null))
  }, [canShowStep])

  React.useEffect(() => {
    if (!canShowStep || !activeStepId) return

    const step = getStepConfig(activeStepId)
    let target: HTMLElement | null = null
    let scrollTimer: number | null = null
    let rectFrame: number | null = null

    const updateRect = () => {
      if (rectFrame) window.cancelAnimationFrame(rectFrame)
      rectFrame = window.requestAnimationFrame(() => {
        if (!target) {
          setHighlightRect(null)
          return
        }
        const rect = target.getBoundingClientRect()
        setHighlightRect({
          top: Math.round(rect.top - 8),
          left: Math.round(rect.left - 8),
          width: Math.round(rect.width + 16),
          height: Math.round(rect.height + 16),
        })
      })
    }

    const applyTarget = () => {
      const nextTarget = document.querySelector<HTMLElement>(step.targetSelector)
      if (nextTarget === target) {
        updateRect()
        return
      }
      target?.removeAttribute("data-onboarding-highlight")
      target = nextTarget
      if (!target) {
        updateRect()
        return
      }
      target.setAttribute("data-onboarding-highlight", "true")
      updateRect()
      if (scrollTimer) window.clearTimeout(scrollTimer)
      scrollTimer = window.setTimeout(() => {
        target?.scrollIntoView({ block: "center", behavior: "smooth" })
        updateRect()
      }, 120)
    }

    applyTarget()
    const observer = new MutationObserver(applyTarget)
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-tour"],
      childList: true,
      subtree: true,
    })
    window.addEventListener("resize", updateRect)
    window.addEventListener("scroll", updateRect, true)
    window.addEventListener("pw-layout-change", updateRect)

    return () => {
      observer.disconnect()
      if (scrollTimer) window.clearTimeout(scrollTimer)
      if (rectFrame) window.cancelAnimationFrame(rectFrame)
      window.removeEventListener("resize", updateRect)
      window.removeEventListener("scroll", updateRect, true)
      window.removeEventListener("pw-layout-change", updateRect)
      target?.removeAttribute("data-onboarding-highlight")
    }
  }, [activeStepId, canShowStep])

  if (!canShowStep || !activeStepId) return null

  const step = getStepConfig(activeStepId)
  const stepNumber = getOnboardingStepIndex(activeStepId, isAdmin)
  const total = isAdmin ? 6 : 5

  return (
    <>
      <style>
        {`
          [data-onboarding-highlight="true"] {
            scroll-margin: 6rem;
          }
        `}
      </style>
      {highlightRect ? (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[149] rounded-xl border-2 border-primary shadow-[0_0_0_6px_color-mix(in_srgb,var(--primary)_12%,transparent)]"
          style={{
            top: highlightRect.top,
            left: highlightRect.left,
            width: highlightRect.width,
            height: highlightRect.height,
          }}
        />
      ) : null}
      <div className="fixed bottom-4 left-4 right-4 z-[150] mx-auto max-w-md sm:left-auto sm:right-5 sm:bottom-5">
        <div className="rounded-2xl border border-border/80 bg-card/95 p-4 shadow-xl shadow-slate-900/10 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-xs font-medium text-primary">
            <span className="rounded-full bg-primary/10 px-2 py-0.5 tabular-nums">
              {stepNumber}/{total}
            </span>
            <span>{t(isAdmin ? "onboarding.flowBadge" : "onboarding.staffFlowBadge")}</span>
          </div>
          <p className="mt-2 text-base font-semibold text-foreground">{t(step.titleKey)}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t(step.hintKey)}</p>
          {stepDone ? (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-primary">
              <Check className="size-3.5" aria-hidden />
              {t("onboarding.stepDetected")}
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">{t("onboarding.stepAutoDetect")}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              className={cn("h-10 flex-1 rounded-xl", !stepDone && "sm:flex-none")}
              disabled={advancing}
              onClick={() => {
                setAdvancing(true)
                void advanceFlowStep().finally(() => setAdvancing(false))
              }}
            >
              {stepDone ? t("onboarding.flowContinue") : t("onboarding.flowCheck")}
              <ArrowRight className="ml-2 size-4" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-10 rounded-xl text-muted-foreground"
              onClick={() => skipForNow()}
            >
              {t("onboarding.skipCard")}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
