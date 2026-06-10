"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { PanelLeftClose, PanelLeftOpen } from "lucide-react"

import { AppSidebar } from "@/components/layout/app-sidebar"
import { AppTopbar } from "@/components/layout/app-topbar"
import { MobileActionFab } from "@/components/layout/mobile-action-fab"
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav"
import { MobilePanelOverlays } from "@/components/layout/mobile-panel-overlays"
import { PwaInstallBanner } from "@/components/pwa/pwa-install-banner"
import { Button } from "@/components/ui/button"
import { useDeferUntilIdle } from "@/lib/react/use-defer-until-idle"
import { cn } from "@/lib/utils"

const HelpFloatingWidgetLazy = dynamic(
  () =>
    import("@/components/help/help-floating-widget").then((m) => ({
      default: m.HelpFloatingWidget,
    })),
  { ssr: false },
)

function DeferredHelpFloatingWidget() {
  const ready = useDeferUntilIdle(600)
  if (!ready) return null
  return <HelpFloatingWidgetLazy />
}

type AppShellProps = {
  children: React.ReactNode
  title?: string
  pageDescription?: string
  /** Glowna akcja w pasku (np. Dodaj wizyte) */
  primaryAction?: React.ReactNode
  className?: string
}

export function AppShell({
  children,
  title,
  pageDescription,
  primaryAction,
  className,
}: AppShellProps) {
  const SIDEBAR_MIN = 240
  const SIDEBAR_MAX = 520
  const SIDEBAR_DEFAULT = 264
  const SIDEBAR_WIDTH_KEY = "pw_sidebar_width_v1"
  const SIDEBAR_COLLAPSED_KEY = "pw_sidebar_collapsed_v1"

  const [sidebarWidth, setSidebarWidth] = React.useState(() => {
    if (typeof window === "undefined") return SIDEBAR_DEFAULT
    const stored = Number(window.localStorage.getItem(SIDEBAR_WIDTH_KEY))
    if (!Number.isFinite(stored)) return SIDEBAR_DEFAULT
    return Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, Math.floor(stored)))
  })
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(() => {
    if (typeof window === "undefined") return false
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1"
  })
  const [isResizing, setIsResizing] = React.useState(false)

  React.useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth))
  }, [sidebarWidth])

  React.useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? "1" : "0")
  }, [sidebarCollapsed])

  React.useEffect(() => {
    if (typeof window === "undefined") return
    // Inform other overlays (np. onboarding highlight), że layout się przesunął.
    window.dispatchEvent(new Event("pw-layout-change"))
  }, [sidebarWidth, sidebarCollapsed])

  React.useEffect(() => {
    if (!isResizing) return
    const prevSelect = document.body.style.userSelect
    const prevCursor = document.body.style.cursor
    document.body.style.userSelect = "none"
    document.body.style.cursor = "col-resize"

    const onPointerMove = (event: PointerEvent) => {
      const next = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, Math.floor(event.clientX)))
      setSidebarWidth(next)
      if (sidebarCollapsed && next > SIDEBAR_MIN) {
        setSidebarCollapsed(false)
      }
    }
    const stopResize = () => {
      setIsResizing(false)
    }
    window.addEventListener("pointermove", onPointerMove)
    window.addEventListener("pointerup", stopResize)
    window.addEventListener("pointercancel", stopResize)
    return () => {
      document.body.style.userSelect = prevSelect
      document.body.style.cursor = prevCursor
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", stopResize)
      window.removeEventListener("pointercancel", stopResize)
    }
  }, [isResizing, sidebarCollapsed])

  return (
    <div className={cn("flex min-h-screen bg-background", className)}>
      <aside
        className={cn(
          "relative hidden shrink-0 border-r border-border/90 bg-[var(--sidebar)] lg:block",
          sidebarCollapsed ? "w-0 border-r-0" : "overflow-hidden",
        )}
        style={sidebarCollapsed ? undefined : { width: `${sidebarWidth}px` }}
      >
        {!sidebarCollapsed ? (
          <div className="sticky top-0 flex h-screen max-h-screen flex-col overflow-hidden">
            <AppSidebar />
          </div>
        ) : null}
        {!sidebarCollapsed ? (
          <>
            <button
              type="button"
              className="absolute inset-y-0 right-0 z-20 w-2 cursor-col-resize bg-transparent hover:bg-primary/15"
              aria-label="Zmien szerokosc panelu bocznego"
              onPointerDown={(event) => {
                event.preventDefault()
                setIsResizing(true)
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="absolute right-1 top-2 z-30 size-7 rounded-lg border-border/80 bg-card/95"
              onClick={() => setSidebarCollapsed(true)}
              aria-label="Zwin panel boczny"
            >
              <PanelLeftClose className="size-4" />
            </Button>
          </>
        ) : null}
      </aside>
      {sidebarCollapsed ? (
        <div className="hidden shrink-0 lg:flex lg:w-10 lg:items-start lg:justify-center lg:pt-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 rounded-lg border-border/80 bg-card/95"
            onClick={() => setSidebarCollapsed(false)}
            aria-label="Rozwin panel boczny"
          >
            <PanelLeftOpen className="size-4" />
          </Button>
        </div>
      ) : null}

      <MobilePanelOverlays className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <AppTopbar
            title={title}
            pageDescription={pageDescription}
            primaryAction={primaryAction}
          />
          <div className="mx-auto w-full max-w-[1320px] flex-1 px-4 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] pt-4 sm:px-6 sm:pt-5 lg:px-10 lg:pb-10">
            {children}
          </div>
        </div>
      </MobilePanelOverlays>
      <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col lg:hidden">
        <PwaInstallBanner />
        <MobileBottomNav />
      </div>
      <MobileActionFab />
      <DeferredHelpFloatingWidget />
    </div>
  )
}
