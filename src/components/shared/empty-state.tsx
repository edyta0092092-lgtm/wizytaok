import type { LucideIcon } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

type EmptyStateProps = {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  actionHref?: string
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
  className,
}: EmptyStateProps) {
  return (
    <Card
      className={cn(
        "border-dashed border-border bg-muted/20 shadow-none",
        className
      )}
    >
      <CardHeader className="items-center px-4 pb-2 pt-6 text-center sm:px-6">
        <span className="mb-3 flex size-11 items-center justify-center rounded-lg border border-border bg-card text-primary">
          <Icon className="size-5" aria-hidden />
        </span>
        <CardTitle className="text-base font-medium">{title}</CardTitle>
        <CardDescription className="max-w-md text-sm leading-relaxed">
          {description}
        </CardDescription>
      </CardHeader>
      {actionLabel && (onAction || actionHref) ? (
        <CardContent className="flex justify-center px-4 pb-6 sm:px-6">
          {actionHref ? (
            <Button variant="default" size="sm" asChild>
              <Link href={actionHref}>{actionLabel}</Link>
            </Button>
          ) : (
            <Button variant="default" size="sm" onClick={onAction}>
              {actionLabel}
            </Button>
          )}
        </CardContent>
      ) : null}
    </Card>
  )
}
