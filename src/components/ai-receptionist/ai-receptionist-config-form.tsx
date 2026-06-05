"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { Switch } from "@/components/ui/switch"
import type {
  AiReceptionistConfig,
  AiReceptionistLanguage,
  AiReceptionistTone,
} from "@/lib/ai-receptionist/types"
import { useTranslations } from "@/lib/i18n/use-translations"

export function AiReceptionistConfigForm({
  config,
  onSave,
}: {
  config: AiReceptionistConfig
  onSave: (next: AiReceptionistConfig) => void
}) {
  const { t } = useTranslations()
  const [draft, setDraft] = React.useState(config)
  const [saved, setSaved] = React.useState(false)

  React.useEffect(() => {
    setDraft(config)
  }, [config])

  const handleSave = () => {
    const name = draft.assistantName.trim() || t("aiReceptionistPanel.defaultAssistantName")
    const next = { ...draft, assistantName: name }
    onSave(next)
    setSaved(true)
    toast.success(t("aiReceptionistPanel.toastSaved"))
    window.setTimeout(() => setSaved(false), 2500)
  }

  return (
    <Card className="rounded-2xl border border-border shadow-sm">
      <CardHeader className="border-b border-border/70 py-4">
        <CardTitle className="text-sm font-semibold">
          {t("aiReceptionistPanel.configTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 pt-4">
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
          <div>
            <p className="text-sm font-medium">{t("aiReceptionistPanel.enabledLabel")}</p>
            <p className="text-xs text-muted-foreground">{t("aiReceptionistPanel.enabledHint")}</p>
          </div>
          <Switch
            checked={draft.enabled}
            onCheckedChange={(enabled) => setDraft((d) => ({ ...d, enabled }))}
            aria-label={t("aiReceptionistPanel.enabledLabel")}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ai-assistant-name">{t("aiReceptionistPanel.assistantNameLabel")}</Label>
          <Input
            id="ai-assistant-name"
            className="h-10 rounded-xl"
            placeholder={t("aiReceptionistPanel.assistantNamePlaceholder")}
            value={draft.assistantName}
            onChange={(e) => setDraft((d) => ({ ...d, assistantName: e.target.value }))}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ai-tone">{t("aiReceptionistPanel.toneLabel")}</Label>
            <NativeSelect
              id="ai-tone"
              className="h-10 w-full rounded-xl"
              value={draft.tone}
              onChange={(e) => setDraft((d) => ({ ...d, tone: e.target.value as AiReceptionistTone }))}
            >
              <option value="friendly">{t("aiReceptionistPanel.toneFriendly")}</option>
              <option value="professional">{t("aiReceptionistPanel.toneProfessional")}</option>
              <option value="concise">{t("aiReceptionistPanel.toneConcise")}</option>
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-language">{t("aiReceptionistPanel.languageLabel")}</Label>
            <NativeSelect
              id="ai-language"
              className="h-10 w-full rounded-xl"
              value={draft.language}
              onChange={(e) =>
                setDraft((d) => ({ ...d, language: e.target.value as AiReceptionistLanguage }))
              }
            >
              <option value="pl">{t("aiReceptionistPanel.languagePl")}</option>
              <option value="en">{t("aiReceptionistPanel.languageEn")}</option>
            </NativeSelect>
          </div>
        </div>

        <Button type="button" className="h-10 rounded-xl" onClick={handleSave}>
          {saved ? t("aiReceptionistPanel.saved") : t("aiReceptionistPanel.saveConfig")}
        </Button>
      </CardContent>
    </Card>
  )
}
