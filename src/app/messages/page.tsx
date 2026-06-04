"use client"

import * as React from "react"
import { Suspense } from "react"
import { Plus } from "lucide-react"

import { MessageTemplatesSection } from "@/components/messages/message-templates-section"
import { CustomTemplatesSection } from "@/components/messages/custom-templates-section"
import { SendingHistorySection } from "@/components/messages/sending-history-section"
import { AppShell } from "@/components/layout/app-shell"
import { PageShell } from "@/components/layout/page-shell"
import { Button } from "@/components/ui/button"
import { AccessDenied } from "@/components/shared/access-denied"
import { useBusinessAccess } from "@/lib/auth/business-access-context"
import { useTranslations } from "@/lib/i18n/use-translations"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"

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
  const [accessDebug, setAccessDebug] = React.useState<Record<string, unknown> | null>(null)
  const registerOpen = React.useCallback((fn: () => void) => {
    openCreateRef.current = fn
  }, [])

  const canOpenMessages = access.canAccessMessages || access.canViewMessageSendHistory

  React.useEffect(() => {
    if (!access.ready || canOpenMessages) return
    if (!isSupabaseConfigured()) {
      queueMicrotask(() => {
        setAccessDebug({
          path: "/messages",
          blockedBy: "messages_guard",
          currentUserId: null,
          businessId: access.businessId,
          effectiveRole: access.effectiveRole,
          canAccessMessages: access.canAccessMessages,
          canViewMessageSendHistory: access.canViewMessageSendHistory,
          rawBusinessMemberRole: null,
          businessMemberIsActive: null,
          rawStaffMemberRole: null,
        })
      })
      return
    }
    const client = getBrowserClient()
    if (!client) return
    let cancelled = false
    void (async () => {
      const {
        data: { user },
      } = await client.auth.getUser()

      const memberQuery = client
        .from("business_members")
        .select("business_id, role, is_active, staff_member_id")
        .eq("user_id", user?.id ?? "")
        .order("updated_at", { ascending: false })
        .limit(5)
      const { data: memberRows } = await memberQuery
      const selectedMember =
        memberRows?.find((row) => row.business_id === access.businessId) ??
        memberRows?.[0] ??
        null

      let staffRole: string | null = null
      if (selectedMember?.staff_member_id) {
        const { data: staffRow } = await client
          .from("staff_members")
          .select("role")
          .eq("id", selectedMember.staff_member_id)
          .maybeSingle()
        staffRole = staffRow?.role?.trim() || null
      }

      const payload = {
        path: "/messages",
        blockedBy: "messages_guard",
        currentUserId: user?.id ?? null,
        businessId: access.businessId,
        effectiveRole: access.effectiveRole,
        canAccessMessages: access.canAccessMessages,
        canViewMessageSendHistory: access.canViewMessageSendHistory,
        rawBusinessMemberRole: selectedMember?.role ?? null,
        businessMemberIsActive:
          typeof selectedMember?.is_active === "boolean" ? selectedMember.is_active : null,
        rawStaffMemberRole: staffRole,
      }
      console.info("[messages.access.diagnostic]", payload)
      if (!cancelled) setAccessDebug(payload)
    })()
    return () => {
      cancelled = true
    }
  }, [
    access.businessId,
    access.canAccessMessages,
    access.canViewMessageSendHistory,
    access.effectiveRole,
    access.ready,
    canOpenMessages,
  ])

  if (access.ready && !canOpenMessages) {
    return (
      <AppShell title={t("navigation.messages")} pageDescription={t("messages.description")}>
        <PageShell>
          <AccessDenied />
          {accessDebug ? (
            <pre className="mt-4 overflow-x-auto rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
              {JSON.stringify(accessDebug, null, 2)}
            </pre>
          ) : null}
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
        <div data-tour="messages-list" className="flex flex-col gap-6">
        {canOpenMessages ? (
          <>
            <MessageTemplatesSection
              onRegisterPrimaryAction={registerOpen}
              readOnly={!access.canManageMessageTemplates}
            />
            <CustomTemplatesSection readOnly={!access.canManageMessageTemplates} />
          </>
        ) : (
          <p className="mb-4 text-sm text-muted-foreground">{t("messages.staffHistoryIntro")}</p>
        )}
        <SendingHistorySection />
        </div>
      </PageShell>
    </AppShell>
  )
}
