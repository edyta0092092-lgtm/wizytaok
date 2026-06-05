"use client"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

function Bone({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-muted/80", className)} />
}

export function CustomersListSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <Card key={i} className="rounded-2xl border border-border shadow-sm">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <Bone className="h-5 w-40" />
            <Bone className="h-4 w-32 sm:ml-auto" />
            <Bone className="h-4 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
