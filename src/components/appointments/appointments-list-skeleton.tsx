"use client"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

function Bone({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-muted/80", className)} />
}

export function AppointmentsListSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Ładowanie wizyt">
      {[0, 1].map((section) => (
        <div key={section} className="space-y-2.5">
          <Bone className="h-4 w-24" />
          <Card className="overflow-hidden rounded-2xl border border-border shadow-sm shadow-slate-900/5">
            <CardContent className="divide-y divide-border p-0">
              {[0, 1, 2].map((row) => (
                <div key={row} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
                  <Bone className="h-16 w-full shrink-0 sm:w-1" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Bone className="h-5 w-40" />
                    <Bone className="h-4 w-56" />
                    <Bone className="h-3 w-32" />
                  </div>
                  <div className="flex gap-2 sm:flex-col sm:items-end">
                    <Bone className="h-7 w-24" />
                    <Bone className="h-9 w-28" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  )
}
