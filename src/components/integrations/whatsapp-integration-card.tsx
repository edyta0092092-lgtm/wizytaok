"use client"

import * as React from "react"
import { Link2, MessageCircle, Save, Unlink } from "lucide-react"
import { toast } from "sonner"

import { WhatsAppDashboardKpis } from "@/components/integrations/whatsapp-dashboard-kpis"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useBusinessAccess } from "@/lib/auth/business-access-context"
import {
  renderWhatsAppTemplate,
  WHATSAPP_TEMPLATE_VARIABLES,
  whatsAppVariablePlaceholder,
} from "@/lib/integrations/whatsapp/template-vars"
import type { WhatsAppProvider, WhatsAppTemplateKind } from "@/lib/integrations/whatsapp/types"
import { useWhatsAppWorkspace } from "@/lib/integrations/whatsapp/use-whatsapp-workspace"
import { useTranslations } from "@/lib/i18n/use-translations"

const TEMPLATE_KINDS: WhatsAppTemplateKind[] = [
  "confirmation",
  "reminder",
  "cancellation",
  "thank_you",
]

function templateKindLabel(t: (key: string) => string, kind: WhatsAppTemplateKind): string {
  const map: Record<WhatsAppTemplateKind, string> = {
    confirmation: t("whatsappIntegration.templateConfirmation"),
    reminder: t("whatsappIntegration.templateReminder"),
    cancellation: t("whatsappIntegration.templateCancellation"),
    thank_you: t("whatsappIntegration.templateThankYou"),
  }
  return map[kind]
}

export function WhatsAppIntegrationCard() {
  const { t } = useTranslations()
  const { businessId } = useBusinessAccess()
  const {
    config,
    previewContext,
    setPreviewContext,
    activeTemplate,
    setActiveTemplate,
    saveConfig,
    setConnected,
    updateTemplateBody,
    toggleTemplateEnabled,
  } = useWhatsAppWorkspace(businessId)

  const [draftPhone, setDraftPhone] = React.useState("")
  const [draftProvider, setDraftProvider] = React.useState<WhatsAppProvider>("meta")
  const [saved, setSaved] = React.useState(false)

  React.useEffect(() => {
    if (!config) return
    setDraftPhone(config.phoneNumber)
    setDraftProvider(config.provider)
  }, [config])

  if (!businessId || !config) {
    return (
      <p className="text-sm text-muted-foreground">{t("whatsappIntegration.loadingBusiness")}</p>
    )
  }

  const connected = config.connected
  const activeBody = config.templates[activeTemplate]?.body ?? ""
  const previewText = renderWhatsAppTemplate(activeBody, previewContext)

  const handleSaveConfig = () => {
    saveConfig({ phoneNumber: draftPhone.trim(), provider: draftProvider })
    setSaved(true)
    toast.success(t("whatsappIntegration.toastSaved"))
    window.setTimeout(() => setSaved(false), 2500)
  }

  const connect = () => {
    if (!draftPhone.trim()) {
      toast.error(t("whatsappIntegration.phoneRequired"))
      return
    }
    saveConfig({ phoneNumber: draftPhone.trim(), provider: draftProvider, connected: true })
    setConnected(true)
    toast.success(t("whatsappIntegration.toastConnected"))
  }

  const disconnect = () => {
    if (!window.confirm(t("whatsappIntegration.disconnectConfirm"))) return
    setConnected(false)
    toast.message(t("whatsappIntegration.toastDisconnected"))
  }

  return (
    <Card
      id="whatsapp"
      className="rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5 scroll-mt-6"
    >
      <CardHeader className="border-b border-border/70 py-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
            <MessageCircle className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm font-semibold">
              {t("whatsappIntegration.cardTitle")}
            </CardTitle>
            <CardDescription className="mt-1 text-xs text-muted-foreground">
              {t("whatsappIntegration.cardDescription")}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-4">
        <StatusBadge connected={connected} t={t} />

        <p className="rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          {t("whatsappIntegration.foundationNotice")}
        </p>

        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("whatsappIntegration.configTitle")}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="wa-provider">{t("whatsappIntegration.providerLabel")}</Label>
              <NativeSelect
                id="wa-provider"
                className="h-10 w-full rounded-xl"
                value={draftProvider}
                onChange={(e) => setDraftProvider(e.target.value as WhatsAppProvider)}
                disabled={connected}
              >
                <option value="meta">{t("whatsappIntegration.providerMeta")}</option>
                <option value="twilio">{t("whatsappIntegration.providerTwilio")}</option>
                <option value="other">{t("whatsappIntegration.providerOther")}</option>
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wa-phone">{t("whatsappIntegration.phoneLabel")}</Label>
              <Input
                id="wa-phone"
                className="h-10 rounded-xl"
                placeholder={t("whatsappIntegration.phonePlaceholder")}
                value={draftPhone}
                onChange={(e) => setDraftPhone(e.target.value)}
                disabled={connected}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {!connected ? (
              <Button type="button" className="h-10 rounded-xl" onClick={connect}>
                <Link2 className="mr-1.5 size-4" aria-hidden />
                {t("whatsappIntegration.connect")}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-xl"
                onClick={disconnect}
              >
                <Unlink className="mr-1.5 size-4" aria-hidden />
                {t("whatsappIntegration.disconnect")}
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              className="h-10 rounded-xl"
              onClick={handleSaveConfig}
              disabled={connected}
            >
              <Save className="mr-1.5 size-4" aria-hidden />
              {saved ? t("whatsappIntegration.saved") : t("whatsappIntegration.saveConfig")}
            </Button>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("whatsappIntegration.statsTitle")}
          </h3>
          <WhatsAppDashboardKpis stats={config.stats} />
          <p className="text-xs text-muted-foreground">{t("whatsappIntegration.statsHint")}</p>
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("whatsappIntegration.templatesTitle")}
          </h3>
          <div className="flex flex-wrap gap-2">
            {TEMPLATE_KINDS.map((kind) => (
              <Button
                key={kind}
                type="button"
                size="sm"
                variant={activeTemplate === kind ? "default" : "outline"}
                className="h-8 rounded-lg text-xs"
                onClick={() => setActiveTemplate(kind)}
              >
                {templateKindLabel(t, kind)}
              </Button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
            <div>
              <p className="text-sm font-medium">{t("whatsappIntegration.templateEnabled")}</p>
              <p className="text-xs text-muted-foreground">
                {templateKindLabel(t, activeTemplate)}
              </p>
            </div>
            <Switch
              checked={config.templates[activeTemplate]?.enabled ?? true}
              onCheckedChange={(enabled) => toggleTemplateEnabled(activeTemplate, enabled)}
              aria-label={t("whatsappIntegration.templateEnabled")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="wa-template-body">{t("whatsappIntegration.templateBodyLabel")}</Label>
            <Textarea
              id="wa-template-body"
              className="min-h-[120px] rounded-xl font-mono text-sm"
              value={activeBody}
              onChange={(e) => updateTemplateBody(activeTemplate, e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t("whatsappIntegration.variablesHint")}{" "}
              {WHATSAPP_TEMPLATE_VARIABLES.map((v) => whatsAppVariablePlaceholder(v)).join(", ")}
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("whatsappIntegration.previewTitle")}
          </h3>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3 rounded-xl border border-border/80 bg-muted/20 p-4">
              <p className="text-xs font-medium text-foreground">
                {t("whatsappIntegration.previewVariables")}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {WHATSAPP_TEMPLATE_VARIABLES.map((variable) => (
                  <div key={variable} className="space-y-1">
                    <Label htmlFor={`wa-var-${variable}`} className="text-xs">
                      {whatsAppVariablePlaceholder(variable)}
                    </Label>
                    <Input
                      id={`wa-var-${variable}`}
                      className="h-9 rounded-lg text-sm"
                      value={previewContext[variable]}
                      onChange={(e) =>
                        setPreviewContext((prev) => ({ ...prev, [variable]: e.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                {t("whatsappIntegration.previewMessage")}
              </p>
              <div className="rounded-2xl rounded-tl-sm border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                {previewText || t("whatsappIntegration.previewEmpty")}
              </div>
            </div>
          </div>
        </section>
      </CardContent>
    </Card>
  )
}

function StatusBadge({
  connected,
  t,
}: {
  connected: boolean
  t: (key: string) => string
}) {
  if (connected) {
    return (
      <Badge variant="default" className="w-fit rounded-lg bg-emerald-600 hover:bg-emerald-600">
        {t("whatsappIntegration.statusConnected")}
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="w-fit rounded-lg">
      {t("whatsappIntegration.statusDisconnected")}
    </Badge>
  )
}
