"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { TourOverlay, type TourOverlayRect } from "@/components/guide/tour-overlay"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { TOUR_STEPS } from "@/lib/guide/tour-steps"
import { useTour } from "@/lib/tour/tour-context"
import { isTourExcludedPublicPath } from "@/lib/tour/tour-path-guard"
import { useTranslations } from "@/lib/i18n/use-translations"

const PADDING = 10

function stepIdToI18nSuffix(id: string): string {
  return id.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
}

function clampRect(r: TourOverlayRect): TourOverlayRect {
  const maxW = typeof window !== "undefined" ? window.innerWidth : 0
  const maxH = typeof window !== "undefined" ? window.innerHeight : 0
  return {
    top: Math.max(0, r.top),
    left: Math.max(0, r.left),
    width: Math.min(r.width, maxW > 0 ? maxW - r.left : r.width),
    height: Math.min(r.height, maxH > 0 ? maxH - r.top : r.height),
  }
}

export function AppTour() {
  const pathname = usePathname()
  const { t } = useTranslations()
  const {
    welcomeOpen,
    dismissWelcome,
    startTour,
    tourActive,
    stepIndex,
    tourReady,
    nextStep,
    prevStep,
    finishTour,
    endTourEarly,
  } = useTour()

  const [rect, setRect] = React.useState<TourOverlayRect | null>(null)
  const step = TOUR_STEPS[stepIndex]
  const total = TOUR_STEPS.length
  const isFinale = Boolean(step?.target === null && tourActive)
  const hasSpotlight = Boolean(
    tourActive && step && step.target !== null && !isFinale
  )
  const targetMissing = Boolean(
    hasSpotlight && step?.target && rect === null
  )

  const updateRect = React.useCallback(() => {
    if (!tourActive || !step || step.target === null) {
      setRect(null)
      return
    }
    const el = document.querySelector(
      `[data-tour="${step.target}"]`
    ) as HTMLElement | null
    if (!el) {
      setRect(null)
      return
    }
    const r = el.getBoundingClientRect()
    setRect(
      clampRect({
        top: r.top - PADDING,
        left: r.left - PADDING,
        width: r.width + PADDING * 2,
        height: r.height + PADDING * 2,
      })
    )
  }, [tourActive, step])

  React.useLayoutEffect(() => {
    const kick = () => queueMicrotask(() => updateRect())
    kick()
    const onScroll = () => kick()
    const onResize = () => kick()
    window.addEventListener("scroll", onScroll, true)
    window.addEventListener("resize", onResize)
    const id = window.setInterval(kick, 380)
    return () => {
      window.removeEventListener("scroll", onScroll, true)
      window.removeEventListener("resize", onResize)
      window.clearInterval(id)
    }
  }, [updateRect])

  React.useEffect(() => {
    if (!step?.target || !hasSpotlight) return
    const el = document.querySelector(`[data-tour="${step.target}"]`)
    el?.scrollIntoView?.({ block: "center", behavior: "smooth" })
    queueMicrotask(() => updateRect())
  }, [step?.target, stepIndex, hasSpotlight, updateRect])

  const suffix = step ? stepIdToI18nSuffix(step.id) : ""
  const stepTitle = step && suffix ? t(`tour.stepTitles.${suffix}`) : ""
  const stepBody = step && suffix ? t(`tour.stepBodies.${suffix}`) : ""

  const progressMax = total
  const progressValue = Math.min(stepIndex + 1, progressMax)
  const stepLabelText = t("tour.stepLabel")
    .replace("{n}", String(progressValue))
    .replace("{total}", String(total))

  if (!tourReady) return null
  if (isTourExcludedPublicPath(pathname)) return null

  return (
    <>
      {welcomeOpen && !tourActive ? (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center bg-black/48 p-4 pb-8 backdrop-blur-[2px] dark:bg-black/58 sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tour-welcome-title"
        >
          <Card className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
            <CardContent className="space-y-4 px-6 py-6">
              <h2
                id="tour-welcome-title"
                className="text-lg font-semibold tracking-tight text-foreground"
              >
                {t("tour.welcomeTitle")}
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t("tour.welcomeBody")}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="sm:min-w-36"
                  onClick={() => dismissWelcome()}
                >
                  {t("tour.welcomeSkip")}
                </Button>
                <Button
                  type="button"
                  className="sm:min-w-36"
                  onClick={() => startTour(0)}
                >
                  {t("tour.welcomeStart")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {hasSpotlight ? <TourOverlay rect={rect} /> : null}

      {tourActive && !isFinale && step ? (
        <div
          className={
            targetMissing
              ? "fixed inset-0 z-[201] flex flex-col items-center justify-center p-4 pointer-events-none sm:p-6"
              : "fixed inset-0 z-[201] flex flex-col justify-end p-4 pb-6 pointer-events-none sm:items-center sm:justify-center sm:p-6"
          }
        >
          <Card className="pointer-events-auto w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
            <CardContent className="space-y-3 px-5 py-4">
              <div className="flex items-center gap-3">
                <p className="shrink-0 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                  {stepLabelText}
                </p>
                <div className="h-1.5 min-w-[6rem] flex-1 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-300"
                    style={{
                      width: `${(progressValue / total) * 100}%`,
                    }}
                  />
                </div>
              </div>
              <h3 className="text-sm font-semibold text-foreground">{stepTitle}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{stepBody}</p>
              {targetMissing ? (
                <p className="text-xs text-amber-700 dark:text-amber-400/90">
                  {t("tour.targetMissingHint")}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mr-auto text-muted-foreground"
                  onClick={() => nextStep()}
                >
                  {t("tour.skipStep")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => endTourEarly()}
                >
                  {t("tour.endGuide")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={stepIndex === 0}
                  onClick={() => prevStep()}
                >
                  {t("tour.back")}
                </Button>
                <Button type="button" size="sm" onClick={() => nextStep()}>
                  {t("tour.next")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {isFinale ? (
        <div className="fixed inset-0 z-[201] flex items-end justify-center bg-black/46 p-4 pb-10 backdrop-blur-[2px] dark:bg-black/56 sm:items-center">
          <Card className="pointer-events-auto w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
            <CardContent className="space-y-4 px-6 py-6">
              <div className="flex items-center gap-3">
                <p className="shrink-0 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("tour.stepLabel")
                    .replace("{n}", String(total))
                    .replace("{total}", String(total))}
                </p>
                <div className="h-1.5 min-w-[6rem] flex-1 rounded-full bg-muted">
                  <div className="h-full w-full rounded-full bg-primary" />
                </div>
              </div>
              <h3 className="text-lg font-semibold text-foreground">
                {t("tour.finaleTitle")}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t("tour.finaleBody")}
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t("tour.finaleHint")}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  asChild
                  className="min-w-[8rem]"
                >
                  <Link href="/dashboard" onClick={() => finishTour()}>
                    {t("tour.goDashboard")}
                  </Link>
                </Button>
                <Button type="button" onClick={() => finishTour()}>
                  {t("tour.closeGuide")}
                </Button>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
                onClick={() => prevStep()}
              >
                {t("tour.back")}
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </>
  )
}
