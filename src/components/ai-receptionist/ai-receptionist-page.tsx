"use client"

import { Bot } from "lucide-react"

import { AiReceptionistChatMock } from "@/components/ai-receptionist/ai-receptionist-chat-mock"
import { AiReceptionistConfigForm } from "@/components/ai-receptionist/ai-receptionist-config-form"
import { AiReceptionistDashboard } from "@/components/ai-receptionist/ai-receptionist-dashboard"
import { AiReceptionistFlowsCard } from "@/components/ai-receptionist/ai-receptionist-flows-card"
import { AccessDenied } from "@/components/shared/access-denied"
import { Card, CardContent } from "@/components/ui/card"
import { useBusinessAccess } from "@/lib/auth/business-access-context"
import { useAiReceptionistWorkspace } from "@/lib/ai-receptionist/use-ai-receptionist-workspace"
import { useTranslations } from "@/lib/i18n/use-translations"

export function AiReceptionistPage() {
  const { t } = useTranslations()
  const { ready: accessReady, businessId, canManageSettings } = useBusinessAccess()
  const { ready, config, stats, demoConversation, saveConfig } = useAiReceptionistWorkspace(
    accessReady ? businessId : undefined,
  )

  if (accessReady && !canManageSettings) {
    return <AccessDenied />
  }

  if (!ready || !config || !stats || !demoConversation) {
    return (
      <p className="text-sm text-muted-foreground">{t("aiReceptionistPanel.loading")}</p>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600">
          <Bot className="size-6" aria-hidden />
        </span>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            {t("aiReceptionistPanel.heading")}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {t("aiReceptionistPanel.lead")}
          </p>
        </div>
      </div>

      <Card className="rounded-2xl border border-dashed border-violet-500/30 bg-violet-500/5 shadow-none">
        <CardContent className="px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          {t("aiReceptionistPanel.foundationNotice")}
        </CardContent>
      </Card>

      <AiReceptionistDashboard config={config} stats={stats} />

      <div className="grid gap-6 lg:grid-cols-2">
        <AiReceptionistConfigForm config={config} onSave={saveConfig} />
        <AiReceptionistChatMock conversation={demoConversation} config={config} />
      </div>

      <AiReceptionistFlowsCard />
    </div>
  )
}
