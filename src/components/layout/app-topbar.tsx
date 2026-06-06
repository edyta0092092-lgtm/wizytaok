"use client"

import { Menu } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type AppTopbarProps = {
  title?: string
  pageDescription?: string
  primaryAction?: React.ReactNode
  onMenuClick?: () => void
  className?: string
}

export function AppTopbar({
  title,
  pageDescription,
  primaryAction,
  onMenuClick,
  className,
}: AppTopbarProps) {
  return (
    <header
      className={cn(
        "flex min-h-[3.75rem] shrink-0 items-center justify-between gap-4 border-b border-border/90 bg-card/80 px-4 py-3.5 backdrop-blur-md sm:px-6 lg:px-10",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 shrink-0 text-muted-foreground hover:text-foreground lg:hidden"
          onClick={onMenuClick}
          aria-label="Menu"
        >
          <Menu className="size-[1.125rem]" />
        </Button>
        {title ? (
          <div className="min-w-0 flex-1">
            <h1 className="text-panel-title">{title}</h1>
            {pageDescription ? (
              <p className="text-panel-caption mt-1 max-w-2xl sm:text-sm sm:leading-normal">
                {pageDescription}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {primaryAction ? (
        <div className="flex shrink-0 items-center gap-2">{primaryAction}</div>
      ) : null}
    </header>
  )
}
