"use client"

import * as React from "react"
import { Suspense } from "react"
import { Plus } from "lucide-react"

import { MessageTemplatesSection } from "@/components/messages/message-templates-section"
import { SendingHistorySection } from "@/components/messages/sending-history-section"
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

  const canOpenMessages =
    access.canAccessMessages ||
    access.canViewMessageSendHistory ||
    access.effectiveRole === "staff"

  if (access.ready && !canOpenMessages) {
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
      pageDescription={t("messages.description")}
      primaryAction={
        access.canManageMessageTemplates ? (
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
        {canOpenMessages ? (
          <MessageTemplatesSection
            onRegisterPrimaryAction={registerOpen}
            readOnly={!access.canManageMessageTemplates}
          />
        ) : (
          <p className="mb-4 text-sm text-muted-foreground">{t("messages.staffHistoryIntro")}</p>
        )}
        <SendingHistorySection />
      </PageShell>
    </AppShell>
  )
}
