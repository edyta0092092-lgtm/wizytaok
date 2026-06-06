import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type PageShellProps = {
  title?: string
  description?: string
  /** Opcjonalna akcja obok tytulu (np. przycisk) - gdy strona nie podaje AppShell title. */
  action?: ReactNode
  children: React.ReactNode
  className?: string
}

export function PageShell({
  title,
  description,
  action,
  children,
  className,
}: PageShellProps) {
  const showHeader = title || description || action

  return (
    <div
      className={cn(
        "w-full py-3 sm:py-4",
        className
      )}
    >
      {showHeader ? (
        <header className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          {title || description ? (
            <div className="min-w-0 space-y-0.5 sm:space-y-1">
              {title ? (
                <h2 className="text-sm font-semibold leading-tight tracking-tight text-foreground sm:text-base">
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              ) : null}
            </div>
          ) : null}
          {action ? (
            <div className="flex shrink-0 items-center gap-2">{action}</div>
          ) : null}
        </header>
      ) : null}
      {children}
    </div>
  )
}
