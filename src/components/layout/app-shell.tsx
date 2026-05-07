"use client"

import * as React from "react"
import dynamic from "next/dynamic"

import { AppSidebar } from "@/components/layout/app-sidebar"
import { AppTopbar } from "@/components/layout/app-topbar"
import { Sheet, SheetContent } from "@/components/ui/sheet"
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
  const [mobileOpen, setMobileOpen] = React.useState(false)

  return (
    <div className={cn("flex min-h-screen bg-background", className)}>
      <aside className="hidden w-[16.5rem] shrink-0 border-r border-border/90 bg-[var(--sidebar)] lg:block">
        <div className="sticky top-0 flex h-screen max-h-screen flex-col overflow-hidden">
          <AppSidebar />
        </div>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="premium-scrollbar w-[min(100%,18rem)] border-border bg-[var(--sidebar)] p-0 sm:max-w-xs"
          showCloseButton
        >
          <AppSidebar onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar
          title={title}
          pageDescription={pageDescription}
          primaryAction={primaryAction}
          onMenuClick={() => setMobileOpen(true)}
        />
        <div className="mx-auto w-full max-w-[1320px] flex-1 px-5 pb-10 pt-5 sm:px-6 lg:px-10">
          {children}
        </div>
      </div>
      <DeferredHelpFloatingWidget />
    </div>
  )
}
