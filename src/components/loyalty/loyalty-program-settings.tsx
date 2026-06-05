"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { LoyaltyProgramConfig, LoyaltyProgramKind } from "@/lib/loyalty/loyalty-types"
import { useTranslations } from "@/lib/i18n/use-translations"

export function LoyaltyProgramSettings({
  program,
  onSave,
}: {
  program: LoyaltyProgramConfig
  onSave: (next: LoyaltyProgramConfig) => void
}) {
  const { t } = useTranslations()
  const [draft, setDraft] = React.useState(program)
  const [saved, setSaved] = React.useState(false)

  React.useEffect(() => {
    setDraft(program)
  }, [program])

  const handleSave = () => {
    onSave({ ...draft, businessId: program.businessId })
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2500)
  }

  return (
    <Card className="rounded-2xl border border-border shadow-sm">
      <CardHeader className="border-b border-border/70 py-4">
        <CardTitle className="text-sm font-semibold">{t("loyaltyPanel.settingsTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 pt-4">
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
          <div>
            <p className="text-sm font-medium">{t("loyaltyPanel.enabledLabel")}</p>
            <p className="text-xs text-muted-foreground">{t("loyaltyPanel.enabledHint")}</p>
          </div>
          <Switch
            checked={draft.enabled}
            onCheckedChange={(enabled) => setDraft((d) => ({ ...d, enabled }))}
            aria-label={t("loyaltyPanel.enabledLabel")}
          />
        </div>

        {draft.kind === "visits_reward" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="visits-for-reward"
              label={t("loyaltyPanel.visitsForReward")}
              value={String(draft.visitsForReward)}
              onChange={(v) =>
                setDraft((d) => ({ ...d, visitsForReward: Math.max(1, Number(v) || 1) }))
              }
            />
            <Field
              id="reward-percent"
              label={t("loyaltyPanel.rewardPercent")}
              value={String(draft.rewardPercent)}
              onChange={(v) =>
                setDraft((d) => ({ ...d, rewardPercent: Math.min(100, Math.max(1, Number(v) || 1)) }))
              }
            />
          </div>
        ) : null}

        {draft.kind === "points" ? (
          <Field
            id="points-per-visit"
            label={t("loyaltyPanel.pointsPerVisit")}
            hint={t("loyaltyPanel.pointsPerVisitHint")}
            value={String(draft.pointsPerCompletedVisit)}
            onChange={(v) =>
              setDraft((d) => ({
                ...d,
                pointsPerCompletedVisit: Math.max(1, Number(v) || 1),
              }))
            }
          />
        ) : null}

        {draft.kind === "vip_tier" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="visits-for-tier"
              label={t("loyaltyPanel.visitsForTier")}
              value={String(draft.visitsForTier)}
              onChange={(v) =>
                setDraft((d) => ({ ...d, visitsForTier: Math.max(1, Number(v) || 1) }))
              }
            />
            <Field
              id="tier-name"
              label={t("loyaltyPanel.tierName")}
              value={draft.tierName}
              onChange={(v) => setDraft((d) => ({ ...d, tierName: v }))}
            />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" className="h-10 rounded-xl" onClick={handleSave}>
            {t("loyaltyPanel.saveProgram")}
          </Button>
          {saved ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-300" role="status">
              {t("loyaltyPanel.saved")}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function Field({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string
  label: string
  hint?: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={1}
        className="h-11 rounded-xl"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
