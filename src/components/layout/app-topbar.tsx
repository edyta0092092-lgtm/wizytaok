"use client"

import Link from "next/link"
import { HelpCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useTranslations } from "@/lib/i18n/use-translations"
import { cn } from "@/lib/utils"

type AppTopbarProps = {
  title?: string
  pageDescription?: string
  primaryAction?: React.ReactNode
  className?: string
}

export function AppTopbar({
  title,
  pageDescription,
  primaryAction,
  className,
}: AppTopbarProps) {
  const { t } = useTranslations()

  return (
    <header
      className={cn(
        "flex min-h-[3.75rem] shrink-0 items-center justify-between gap-4 border-b border-border/90 bg-card/80 px-4 py-3.5 pt-[calc(0.875rem+var(--safe-area-top))] backdrop-blur-md sm:px-6 lg:px-10 lg:pt-3.5",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
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

      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 touch-manipulation text-muted-foreground hover:text-foreground lg:hidden"
          asChild
        >
          <Link href="/help" aria-label={t("navigation.help")}>
            <HelpCircle className="size-5" aria-hidden />
          </Link>
        </Button>
        {primaryAction ? primaryAction : null}
      </div>
    </header>
  )
}
