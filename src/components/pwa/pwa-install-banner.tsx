"use client"

import * as React from "react"
import { Download, Share, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useTranslations } from "@/lib/i18n/use-translations"
import { cn } from "@/lib/utils"

const DISMISS_KEY = "pw_pwa_install_dismissed_v1"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false
  if (window.matchMedia("(display-mode: standalone)").matches) return true
  const nav = navigator as Navigator & { standalone?: boolean }
  return Boolean(nav.standalone)
}

function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent
  const isIos = /iPad|iPhone|iPod/.test(ua)
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)
  return isIos && isSafari
}

type PwaInstallBannerProps = {
  className?: string
}

export function PwaInstallBanner({ className }: PwaInstallBannerProps) {
  const { t } = useTranslations()
  const [visible, setVisible] = React.useState(false)
  const [iosHint, setIosHint] = React.useState(false)
  const deferredRef = React.useRef<BeforeInstallPromptEvent | null>(null)

  React.useEffect(() => {
    if (typeof window === "undefined") return
    if (isStandaloneDisplay()) return
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "1") return
    } catch {
      // noop
    }

    const onBip = (event: Event) => {
      event.preventDefault()
      deferredRef.current = event as BeforeInstallPromptEvent
      setIosHint(false)
      setVisible(true)
    }

    window.addEventListener("beforeinstallprompt", onBip)

    if (isIosSafari()) {
      queueMicrotask(() => {
        setIosHint(true)
        setVisible(true)
      })
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBip)
    }
  }, [])

  const dismiss = React.useCallback(() => {
    setVisible(false)
    try {
      window.localStorage.setItem(DISMISS_KEY, "1")
    } catch {
      // noop
    }
  }, [])

  const onInstall = React.useCallback(async () => {
    const ev = deferredRef.current
    if (!ev) return
    await ev.prompt()
    await ev.userChoice
    deferredRef.current = null
    dismiss()
  }, [dismiss])

  if (!visible) return null

  return (
    <div
      role="region"
      aria-label={t("pwa.installTitle")}
      className={cn(
        "border-t border-border/80 bg-card/95 px-4 py-3 shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.25)] backdrop-blur-md dark:shadow-none",
        className
      )}
    >
      <div className="mx-auto flex max-w-lg min-w-0 items-start gap-3">
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-2xl bg-teal-500/12 text-teal-700 dark:text-teal-200">
          {iosHint ? (
            <Share className="size-5" aria-hidden />
          ) : (
            <Download className="size-5" aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            {iosHint ? t("pwa.iosTitle") : t("pwa.installTitle")}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {iosHint ? (
              <>
                {t("pwa.iosStep1")}
                <br />
                {t("pwa.iosStep2")}
              </>
            ) : (
              t("pwa.installDescription")
            )}
          </p>
          {!iosHint ? (
            <Button
              type="button"
              size="sm"
              className="mt-2.5 h-10 rounded-xl px-4 text-xs font-semibold sm:text-sm"
              onClick={() => void onInstall()}
            >
              {t("pwa.installButton")}
            </Button>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 shrink-0 rounded-xl text-muted-foreground"
          onClick={dismiss}
          aria-label={t("pwa.installDismiss")}
        >
          <X className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  )
}
