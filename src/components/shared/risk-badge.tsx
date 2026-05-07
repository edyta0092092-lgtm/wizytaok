import { semanticStatusBadgeClass } from "@/components/shared/status-tone"
import type { NoShowRisk } from "@/types/domain"

const riskCopy: Record<Exclude<NoShowRisk, "none">, string> = {
  low: "Niskie ryzyko",
  medium: "Średnie ryzyko",
  high: "Wysokie ryzyko",
}

const riskTone: Record<Exclude<NoShowRisk, "none">, "success" | "warning" | "danger"> = {
  low: "success",
  medium: "warning",
  high: "danger",
}

type RiskBadgeProps = {
  risk?: NoShowRisk
  className?: string
}

export function RiskBadge({ risk = "none", className }: RiskBadgeProps) {
  if (risk === "none") {
    return null
  }

  return (
    <span className={semanticStatusBadgeClass(riskTone[risk], className)}>
      {riskCopy[risk]}
    </span>
  )
}
