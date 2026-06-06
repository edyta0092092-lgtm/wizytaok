"use client"

import * as React from "react"
import { Suspense } from "react"
import { Plus } from "lucide-react"

import { MessageTemplatesSection } from "@/components/messages/message-templates-section"
import { CustomTemplatesSection } from "@/components/messages/custom-templates-section"
import { SendingHistorySection } from "@/components/messages/sending-history-section"
import { SmsQuotaStatusCard } from "@/components/messages/sms-quota-status-card"
import { AppShell } from "@/components/layout/app-shell"
import { PageShell } from "@/components/layout/page-shell"
import { Button } from "@/components/ui/button"
import { AccessDenied } from "@/components/shared/access-denied"
import { useBusinessAccess } from "@/lib/auth/business-access-context"
import { useTranslations } from "@/lib/i18n/use-translations"
export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="min-h-[40vh]" aria-hidden />}>
      <MessagesPageContent />
    </Suspense>
  )
}

function MessagesPageContent() {
  const { t } = useTranslations()
  const access = useBusinessAccess()
  const openCreateRef = React.useRef<(() => void) | null>(null)
  const registerOpen = React.useCallback((fn: () => void) => {
    openCreateRef.current = fn
  }, [])

  const canOpenMessagesPage =
    access.canAccessMessages || access.canViewMessageSendHistory
  const canManageTemplates = access.canManageMessageTemplates

  if (access.ready && !canOpenMessagesPage) {
    return (
      <AppShell title={t("navigation.messages")} pageDescription={t("messages.description")}>
        <PageShell>
          <AccessDenied />
        </PageShell>
      </AppShell>
    )
  }

  return (
    <AppShell
      title={t("navigation.messages")}
      pageDescription={
        canManageTemplates ? t("messages.description") : t("messages.staffHistoryIntro")
      }
      primaryAction={
        canManageTemplates ? (
          <Button
            type="button"
            size="sm"
            className="h-9 gap-1 text-sm"
            onClick={() => openCreateRef.current?.()}
          >
            <Plus className="size-3.5" />
            {t("common.addTemplate")}
          </Button>
        ) : undefined
      }
    >
      <PageShell>
        <div data-tour="messages-list" className="flex flex-col gap-6">
        <SmsQuotaStatusCard />
        {canManageTemplates ? (
          <>
            <MessageTemplatesSection onRegisterPrimaryAction={registerOpen} readOnly={false} />
            <CustomTemplatesSection readOnly={false} />
          </>
        ) : null}
        <SendingHistorySection />
        </div>
      </PageShell>
    </AppShell>
  )
}
