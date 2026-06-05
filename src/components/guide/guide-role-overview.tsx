"use client"

import Link from "next/link"
import { Shield, UserRound } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type GuideRoleOverviewProps = {
  isAdmin: boolean
  staffTitle: string
  staffLead: string
  staffCanTitle: string
  staffCanBody: string
  staffCannotTitle: string
  staffCannotBody: string
  adminTitle: string
  adminLead: string
  adminExtraTitle: string
  adminExtraBody: string
  adminSectionAnchorLabel: string
  className?: string
}

export function GuideRoleOverview({
  isAdmin,
  staffTitle,
  staffLead,
  staffCanTitle,
  staffCanBody,
  staffCannotTitle,
  staffCannotBody,
  adminTitle,
  adminLead,
  adminExtraTitle,
  adminExtraBody,
  adminSectionAnchorLabel,
  className,
}: GuideRoleOverviewProps) {
  return (
    <div className={cn("grid gap-4 lg:grid-cols-2", className)}>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm shadow-slate-900/5">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-primary">
            <UserRound className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 space-y-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">{staffTitle}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{staffLead}</p>
            </div>
            <div className="space-y-2 text-sm">
              <p>
                <span className="font-medium text-foreground">{staffCanTitle}</span>
                <span className="mt-0.5 block whitespace-pre-line text-muted-foreground">{staffCanBody}</span>
              </p>
              <p>
                <span className="font-medium text-foreground">{staffCannotTitle}</span>
                <span className="mt-0.5 block whitespace-pre-line text-muted-foreground">{staffCannotBody}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {isAdmin ? (
        <div className="rounded-2xl border border-primary/25 bg-primary/5 p-5 shadow-sm shadow-primary/10 dark:bg-primary/10">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Shield className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 space-y-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">{adminTitle}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{adminLead}</p>
              </div>
              <p className="text-sm">
                <span className="font-medium text-foreground">{adminExtraTitle}</span>
                <span className="mt-0.5 block whitespace-pre-line text-muted-foreground">{adminExtraBody}</span>
              </p>
              <Button asChild variant="outline" size="sm" className="h-9 rounded-xl">
                <Link href="#guide-admin-section">{adminSectionAnchorLabel}</Link>
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
