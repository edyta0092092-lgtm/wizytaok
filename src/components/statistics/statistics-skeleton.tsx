import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-muted/70", className)} />
}

export function StatisticsSkeleton() {
  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 8 }).map((_, index) => (
          <Card key={index} className="rounded-3xl border-border/80">
            <CardContent className="px-4 py-4">
              <SkeletonBlock className="h-3 w-24" />
              <SkeletonBlock className="mt-4 h-8 w-16" />
              <SkeletonBlock className="mt-3 h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </section>
      <SkeletonBlock className="h-[28rem] w-full rounded-3xl" />
      <div className="grid gap-6 lg:grid-cols-2">
        <SkeletonBlock className="h-80 rounded-3xl" />
        <SkeletonBlock className="h-80 rounded-3xl" />
      </div>
    </div>
  )
}
