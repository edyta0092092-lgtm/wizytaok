"use client"

import { Gift, Medal, Sparkles } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { LoyaltyProgramKind } from "@/lib/loyalty/loyalty-types"
import { cn } from "@/lib/utils"

const ICONS = {
  visits_reward: Gift,
  points: Sparkles,
  vip_tier: Medal,
} as const

export function LoyaltyProgramTypeCards({
  activeKind,
  onSelect,
  cards,
}: {
  activeKind: LoyaltyProgramKind
  onSelect: (kind: LoyaltyProgramKind) => void
  cards: Array<{
    kind: LoyaltyProgramKind
    title: string
    description: string
    example: string
  }>
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cards.map((card) => {
        const Icon = ICONS[card.kind]
        const selected = activeKind === card.kind
        return (
          <button
            key={card.kind}
            type="button"
            onClick={() => onSelect(card.kind)}
            className="text-left"
          >
            <Card
              className={cn(
                "h-full rounded-2xl border transition-shadow hover:shadow-md",
                selected
                  ? "border-primary ring-2 ring-primary/20 shadow-sm"
                  : "border-border/70 shadow-sm",
              )}
            >
              <CardHeader className="pb-2">
                <span
                  className={cn(
                    "mb-2 flex size-10 items-center justify-center rounded-xl",
                    selected ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
                <CardTitle className="text-base">{card.title}</CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  {card.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs font-medium text-muted-foreground">{card.example}</p>
              </CardContent>
            </Card>
          </button>
        )
      })}
    </div>
  )
}
