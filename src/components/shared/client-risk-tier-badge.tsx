"use client"

import { semanticStatusBadgeClass } from "@/components/shared/status-tone"
import { useTranslations } from "@/lib/i18n/use-translations"
import type { ClientRiskTier } from "@/types/domain"

const tierTone: Record<ClientRiskTier, "success" | "warning" | "danger"> = {
  low: "success",
  medium: "warning",
  high: "danger",
}

type ClientRiskTierBadgeProps = {
  tier: ClientRiskTier
  className?: string
}

export function ClientRiskTierBadge({
  tier,
  className,
}: ClientRiskTierBadgeProps) {
  const { t } = useTranslations()
  const label = t(`labels.riskTier.${tier}` as "labels.riskTier.low")
  return (
    <span className={semanticStatusBadgeClass(tierTone[tier], className)}>
      {label}
    </span>
  )
}
