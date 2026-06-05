import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-muted/60", className)} />
}

export function StatisticsSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, index) => (
          <Card key={index} className="rounded-2xl border-border/60">
            <CardContent className="px-4 py-4 sm:px-5 sm:py-5">
              <SkeletonBlock className="h-3 w-28" />
              <SkeletonBlock className="mt-4 h-9 w-14" />
            </CardContent>
          </Card>
        ))}
      </div>
      <SkeletonBlock className="h-[22rem] w-full rounded-2xl" />
      <div className="grid gap-6 lg:grid-cols-2">
        <SkeletonBlock className="h-72 rounded-2xl" />
        <SkeletonBlock className="h-72 rounded-2xl" />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <SkeletonBlock className="h-80 rounded-2xl" />
        <SkeletonBlock className="h-64 rounded-2xl" />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <SkeletonBlock className="h-64 rounded-2xl" />
        <SkeletonBlock className="h-80 rounded-2xl" />
      </div>
    </div>
  )
}
