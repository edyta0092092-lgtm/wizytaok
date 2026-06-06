"use client"

import * as React from "react"
import Link from "next/link"
import { Send } from "lucide-react"

import { AppShell } from "@/components/layout/app-shell"
import { PageShell } from "@/components/layout/page-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useBusinessAccess } from "@/lib/auth/business-access-context"
import {
  getSupportConversationMessages,
  isConversationClosed,
  type SupportMessage,
  type SupportConversation,
} from "@/lib/help/support-store"
import { useTranslations } from "@/lib/i18n/use-translations"
import { extractErrorMessage, toUserFacingErrorMessage } from "@/lib/ui/user-facing-error"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import type { RealtimeChannel } from "@supabase/supabase-js"

function statusLabel(t: (key: string) => string, value: string): string {
  if (value === "closed") return t("help.statusClosed")
  return t("help.statusOpen")
}

function dateLabel(input: string, language: "pl" | "en"): string {
  const locale = language === "en" ? "en-US" : "pl-PL"
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(input))
}

function isSchemaCacheRefreshError(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes("schema cache") &&
    (normalized.includes("support_conversations") ||
      normalized.includes("support_messages") ||
      normalized.includes("could not find the table"))
  )
}

function isMissingColumnError(message: string, columnName: string): boolean {
  const normalized = message.toLowerCase()
  return normalized.includes("could not find the") && normalized.includes(columnName.toLowerCase())
}

export default function HelpPage() {
  return <HelpPageContent />
}

function HelpPageContent() {
  const { t, language } = useTranslations()
  const { businessId } = useBusinessAccess()
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null)
  const [conversations, setConversations] = React.useState<SupportConversation[]>([])
  const [activeConversationId, setActiveConversationId] = React.useState<string | null>(null)
  const [statusFilter, setStatusFilter] = React.useState<"all" | "open" | "closed">("all")
  const [messages, setMessages] = React.useState<SupportMessage[]>([])
  const [draft, setDraft] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [sending, setSending] = React.useState(false)
  const [errorText, setErrorText] = React.useState<string | null>(null)
  const [infoText, setInfoText] = React.useState<string | null>(null)
  const scrollRef = React.useRef<HTMLDivElement | null>(null)
  const messageChannelRef = React.useRef<RealtimeChannel | null>(null)
  const conversationListChannelRef = React.useRef<RealtimeChannel | null>(null)
  const listMessageChannelRef = React.useRef<RealtimeChannel | null>(null)
  const [lastMessageByConversation, setLastMessageByConversation] = React.useState<Record<string, SupportMessage | null>>({})
  const [closedBySupportConversationIds, setClosedBySupportConversationIds] = React.useState<Record<string, true>>({})
  const localStatusUpdateRef = React.useRef<Record<string, true>>({})
  const conversationIdsRef = React.useRef<Set<string>>(new Set())
  const collapseChatOnNextLoadRef = React.useRef(false)

  const activeConversation = React.useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId) ?? null,
    [conversations, activeConversationId]
  )

  React.useEffect(() => {
    conversationIdsRef.current = new Set(conversations.map((conversation) => conversation.id))
  }, [conversations])

  const loadConversations = React.useCallback(
    async (userIdParam: string, preferredId?: string | null) => {
      if (!businessId) return
      const client = getBrowserClient()
      if (!client) return

      let { data, error } = await client
        .from("support_conversations")
        .select("*")
        .eq("business_id", businessId)
        .eq("user_id", userIdParam)
        .filter("hidden_for_user_at", "is", null)
        .order("updated_at", { ascending: false })
      if (error && isMissingColumnError(error.message, "hidden_for_user_at")) {
        const fallbackResult = await client
          .from("support_conversations")
          .select("*")
          .eq("business_id", businessId)
          .eq("user_id", userIdParam)
          .order("updated_at", { ascending: false })
        data = fallbackResult.data
        error = fallbackResult.error
      }

      if (error) throw error
      const next = (data ?? []) as SupportConversation[]
      setConversations(next)

      const nextActiveId = collapseChatOnNextLoadRef.current
        ? null
        : (preferredId && next.some((conversation) => conversation.id === preferredId)
            ? preferredId
            : next.find((conversation) => conversation.status === "open")?.id ?? next[0]?.id) ?? null
      collapseChatOnNextLoadRef.current = false
      setActiveConversationId(nextActiveId)

      if (next.length === 0) {
        setMessages([])
        setLastMessageByConversation({})
        return
      }

      const conversationIds = next.map((conversation) => conversation.id)
      const { data: messageRows } = await client
        .from("support_messages")
        .select("*")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false })

      const previewMap: Record<string, SupportMessage | null> = {}
      for (const conversation of next) previewMap[conversation.id] = null
      for (const row of (messageRows ?? []) as SupportMessage[]) {
        const conversationId = String(row.conversation_id ?? "")
        if (!conversationId || previewMap[conversationId]) continue
        previewMap[conversationId] = row
      }
      setLastMessageByConversation(previewMap)
    },
    [businessId]
  )

  React.useEffect(() => {
    if (!businessId) return
    queueMicrotask(() => {
      void (async () => {
        setLoading(true)
        try {
          const client = getBrowserClient()
          const { data: authData } = client ? await client.auth.getUser() : { data: { user: null } }
          const userId = authData.user?.id ?? null
          setCurrentUserId(userId)
          if (!userId) {
            setConversations([])
            setActiveConversationId(null)
            setMessages([])
            return
          }
          await loadConversations(userId)
        } catch {
          setErrorText(t("help.loadConversationError"))
        } finally {
          setLoading(false)
        }
      })()
    })
  }, [businessId, loadConversations, t])

  React.useEffect(() => {
    if (!activeConversationId) return
    queueMicrotask(() => {
      void (async () => {
        try {
          const initialMessages = await getSupportConversationMessages(activeConversationId)
          setMessages(initialMessages)
        } catch {
          setErrorText(t("help.loadConversationError"))
        }
      })()
    })
  }, [activeConversationId, t])

  React.useEffect(() => {
    if (!activeConversationId || !isSupabaseConfigured()) return
    const client = getBrowserClient()
    if (!client) return

    if (messageChannelRef.current) {
      void client.removeChannel(messageChannelRef.current)
    }
    messageChannelRef.current = null

    const channel = client
      .channel(`support_messages:${activeConversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `conversation_id=eq.${activeConversationId}`,
        },
        (payload) => {
          const message = payload.new as SupportMessage
          setMessages((prev) => {
            if (prev.some((item) => item.id === message.id)) return prev
            return [...prev, message]
          })
        }
      )
      .subscribe()

    messageChannelRef.current = channel
    return () => {
      void client.removeChannel(channel)
      if (messageChannelRef.current === channel) {
        messageChannelRef.current = null
      }
    }
  }, [activeConversationId])

  React.useEffect(() => {
    if (!isSupabaseConfigured() || !businessId || !currentUserId) return
    const client = getBrowserClient()
    if (!client) return

    if (conversationListChannelRef.current) {
      void client.removeChannel(conversationListChannelRef.current)
    }
    conversationListChannelRef.current = null

    const channel = client
      .channel(`support_conversations:list:${businessId}:${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "support_conversations",
        },
        (payload) => {
          if (payload.eventType === "UPDATE") {
            const updated = payload.new as SupportConversation
            const updatedId = String((payload.new as { id?: string } | null)?.id ?? "")
            const shouldHandle =
              (updatedId && conversationIdsRef.current.has(updatedId)) || activeConversationId === updatedId
            if (!shouldHandle) return
            console.info("[help.conversation.realtime.update]", {
              id: updated.id,
              status: updated.status,
              closed_by: (payload.new as { closed_by?: string } | null)?.closed_by ?? null,
              closed_at: (payload.new as { closed_at?: string } | null)?.closed_at ?? null,
              updated_at: updated.updated_at,
            })
            const wasLocal = Boolean(localStatusUpdateRef.current[updated.id])
            if (wasLocal) {
              delete localStatusUpdateRef.current[updated.id]
            } else if (updated.status === "closed") {
              setClosedBySupportConversationIds((prev) => ({ ...prev, [updated.id]: true }))
            } else if (updated.status === "open") {
              setClosedBySupportConversationIds((prev) => {
                const next = { ...prev }
                delete next[updated.id]
                return next
              })
            }
            const upd = updated as typeof updated & {
              closed_by?: string | null
              closed_at?: string | null
            }
            setConversations((prev) =>
              prev.map((conversation) =>
                conversation.id === updated.id
                  ? ({
                      ...conversation,
                      status: upd.status,
                      closed_by: upd.closed_by ?? null,
                      closed_at: upd.closed_at ?? null,
                      updated_at: upd.updated_at,
                    } as SupportConversation)
                  : conversation
              )
            )
            if (updated.status === "closed" && activeConversationId === updated.id) {
              collapseChatOnNextLoadRef.current = true
              setActiveConversationId(null)
              setMessages([])
              setInfoText(t("help.conversationClosed"))
            }
          }
          if (payload.eventType === "DELETE") {
            const deletedId = String((payload.old as { id?: string } | null)?.id ?? "")
            if (deletedId) {
              setConversations((prev) => prev.filter((conversation) => conversation.id !== deletedId))
              setLastMessageByConversation((prev) => {
                const next = { ...prev }
                delete next[deletedId]
                return next
              })
              setActiveConversationId((prev) => (prev === deletedId ? null : prev))
              setMessages((prev) => (activeConversationId === deletedId ? [] : prev))
            }
          }
          if (payload.eventType !== "UPDATE") {
            void loadConversations(currentUserId, activeConversationId)
          }
        }
      )
      .subscribe()

    conversationListChannelRef.current = channel
    return () => {
      void client.removeChannel(channel)
      if (conversationListChannelRef.current === channel) {
        conversationListChannelRef.current = null
      }
    }
  }, [activeConversationId, businessId, currentUserId, loadConversations, t])

  React.useEffect(() => {
    if (!isSupabaseConfigured() || !businessId || !currentUserId) return
    const client = getBrowserClient()
    if (!client) return

    if (listMessageChannelRef.current) {
      void client.removeChannel(listMessageChannelRef.current)
    }
    listMessageChannelRef.current = null

    const channel = client
      .channel(`support_messages:list:${businessId}:${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `business_id=eq.${businessId}`,
        },
        (payload) => {
          const row = payload.new as SupportMessage
          if (!row.conversation_id) return
          setLastMessageByConversation((prev) => ({ ...prev, [row.conversation_id as string]: row }))
          if (!conversationIdsRef.current.has(String(row.conversation_id))) {
            void loadConversations(currentUserId, activeConversationId)
          }
        }
      )
      .subscribe()

    listMessageChannelRef.current = channel
    return () => {
      void client.removeChannel(channel)
      if (listMessageChannelRef.current === channel) {
        listMessageChannelRef.current = null
      }
    }
  }, [activeConversationId, businessId, currentUserId, loadConversations])

  React.useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  const isClosed = isConversationClosed(activeConversation?.status ?? "open")
  const visibleConversations = React.useMemo(() => {
    if (statusFilter === "all") return conversations
    return conversations.filter((conversation) => conversation.status === statusFilter)
  }, [conversations, statusFilter])
  const activePreview = activeConversationId ? lastMessageByConversation[activeConversationId] : null

  const handleSetConversationStatus = async (conversationId: string, status: "open" | "closed") => {
    const client = getBrowserClient()
    if (!client) return
    setErrorText(null)
    setInfoText(null)

    try {
      const { data: authData } = await client.auth.getUser()
      const userId = authData.user?.id ?? null
      const userEmail = authData.user?.email ?? null
      localStatusUpdateRef.current[conversationId] = true
      const { error } = await client
        .from("support_conversations")
        .update({
          status,
          updated_at: new Date().toISOString(),
          closed_at: status === "closed" ? new Date().toISOString() : null,
          closed_by: status === "closed" ? "user" : null,
        } as never)
        .eq("id", conversationId)
      console.info("[support.status.update]", {
        conversationId,
        nextStatus: status,
        userId,
        userEmail,
        error: error?.message ?? null,
      })
      if (error) throw error
      if (status === "open") {
        setClosedBySupportConversationIds((prev) => {
          const next = { ...prev }
          delete next[conversationId]
          return next
        })
      }
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.id === conversationId
            ? ({ ...conversation, status, updated_at: new Date().toISOString() } as SupportConversation)
            : conversation
        )
      )
      if (status === "closed" && activeConversationId === conversationId) {
        collapseChatOnNextLoadRef.current = true
        setActiveConversationId(null)
        setMessages([])
        setInfoText(t("help.conversationClosed"))
      } else if (status === "open") {
        collapseChatOnNextLoadRef.current = false
        setActiveConversationId(conversationId)
      }
      if (currentUserId) {
        await loadConversations(currentUserId, status === "open" ? conversationId : activeConversationId ?? conversationId)
      }
    } catch (error) {
      delete localStatusUpdateRef.current[conversationId]
      setErrorText(toUserFacingErrorMessage(error, t))
    }
  }

  const handleDeleteConversation = async (conversationId: string) => {
    const confirmed = window.confirm(
      `${t("help.deleteConversationConfirm")}\n${t("help.deleteConversationIrreversible")}`
    )
    if (!confirmed) return
    const client = getBrowserClient()
    if (!client) return
    setErrorText(null)
    setInfoText(null)
    try {
      const { data: authData } = await client.auth.getUser()
      const userId = authData.user?.id ?? null
      const userEmail = authData.user?.email ?? null

      console.info("[support.delete.start]", {
        conversationId,
        businessId: businessId ?? null,
        userId,
        userEmail,
      })

      const { data: deletedData, error: conversationError } = await client
        .from("support_conversations")
        .update({ hidden_for_user_at: new Date().toISOString(), updated_at: new Date().toISOString() } as never)
        .eq("id", conversationId)
        .select("id")

      console.info("[support.delete.conversation]", {
        conversationId,
        conversationError: conversationError?.message ?? null,
        deletedData,
      })

      if (conversationError) {
        setErrorText(toUserFacingErrorMessage(conversationError, t))
        return
      }
      if (!deletedData || deletedData.length === 0) {
        setErrorText(t("errors.genericTryAgain"))
        return
      }

      const nextActive =
        activeConversationId === conversationId
          ? conversations.find((conversation) => conversation.id !== conversationId)?.id ?? null
          : activeConversationId
      setConversations((prev) => prev.filter((conversation) => conversation.id !== conversationId))
      setActiveConversationId(nextActive)
      setMessages((prev) => (activeConversationId === conversationId ? [] : prev))
      setInfoText(t("help.conversationDeleted"))
      if (currentUserId) {
        await loadConversations(currentUserId, nextActive)
      }
    } catch (error) {
      const detailsMessage = extractErrorMessage(error)
      console.info("[support.delete.conversation]", {
        conversationId,
        conversationError: detailsMessage,
        deletedData: null,
      })
      setErrorText(toUserFacingErrorMessage(error, t))
    }
  }

  const handleCreateNewConversation = async () => {
    if (!businessId || !currentUserId) return
    const client = getBrowserClient()
    if (!client) return
    setErrorText(null)
    setInfoText(null)

    try {
      const { data: conversation, error } = await client
        .from("support_conversations")
        .insert({
          business_id: businessId,
          user_id: currentUserId,
          status: "open",
          subject: "Pomoc techniczna",
        })
        .select("*")
        .single()
      if (error) throw error

      const insertedConversation = conversation as SupportConversation
      setActiveConversationId(insertedConversation.id)
      setMessages([])
      setDraft("")
      setInfoText(t("help.emptyStateDescription"))
      await loadConversations(currentUserId, insertedConversation.id)
    } catch (error) {
      console.info("[help.createConversation]", { error: extractErrorMessage(error) })
      setErrorText(toUserFacingErrorMessage(error, t))
    }
  }

  const handleSend = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const body = draft.trim()
    if (!businessId) {
      if (process.env.NODE_ENV !== "production") {
        setErrorText(t("help.missingBusinessIdDev"))
      }
      return
    }
    if (!body) {
      setErrorText(t("help.validationMessageRequired"))
      return
    }
    if (isClosed) {
      setErrorText(t("help.conversationClosed"))
      return
    }

    setSending(true)
    let conversationId = activeConversationId
    let currentUserId: string | null = null
    const client = getBrowserClient()
    if (!client) {
      setErrorText(t("help.clientUnavailable"))
      setSending(false)
      return
    }
    try {
      const { data: authData, error: authError } = client ? await client.auth.getUser() : { data: { user: null }, error: null }
      if (authError || !authData.user?.id) {
        setErrorText(t("help.loginRequiredToSend"))
        return
      }
      currentUserId = authData.user.id

      console.info("[support.chat.send.start]", {
        userId: currentUserId,
        businessId,
        conversationId,
        bodyLength: body.length,
      })

      if (!conversationId) {
        const { data: conversation, error: conversationError } = await client
          .from("support_conversations")
          .insert({
            business_id: businessId,
            user_id: currentUserId,
            status: "open",
            subject: "Pomoc techniczna",
          })
          .select("*")
          .single()

        console.info("[support.chat.conversation.insert]", {
          conversation,
          error: conversationError ? extractErrorMessage(conversationError) : null,
        })

        if (conversationError) {
          throw conversationError
        }
        if (!conversation?.id) {
          throw new Error("Conversation insert returned no id.")
        }
        setActiveConversationId(conversation.id)
        conversationId = conversation.id
      }

      const { data: message, error: messageError } = await client
        .from("support_messages")
        .insert({
          conversation_id: conversationId,
          business_id: businessId,
          sender_user_id: currentUserId,
          sender_role: "user",
          body,
        })
        .select("*")
        .single()

      console.info("[support.chat.message.insert]", {
        message,
        error: messageError ? extractErrorMessage(messageError) : null,
      })

      if (messageError) {
        throw messageError
      }
      if (!message) {
        throw new Error("Message insert returned empty row.")
      }

      const inserted = message as SupportMessage
      setMessages((prev) => (prev.some((item) => item.id === inserted.id) ? prev : [...prev, inserted]))
      setLastMessageByConversation((prev) => ({ ...prev, [conversationId as string]: inserted }))
      await client
        .from("support_conversations")
        .update({
          updated_at: new Date().toISOString(),
          ...(activeConversation?.status === "closed" ? { status: "open" } : {}),
        })
        .eq("id", conversationId)
      console.info("[support.chat.send]", {
        userId: currentUserId,
        conversationId,
        businessId,
        bodyLength: body.length,
        conversationError: null,
        messageError: null,
      })
      setDraft("")
      setErrorText(null)
      setInfoText(t("help.sendMessageSuccess"))
      if (currentUserId) {
        await loadConversations(currentUserId, conversationId)
      }
    } catch (error) {
      const detailsMessage = extractErrorMessage(error)
      console.info("[support.chat.send]", {
        userId: currentUserId,
        conversationId,
        businessId,
        bodyLength: body.length,
        conversationError: null,
        messageError: detailsMessage,
      })
      if (isSchemaCacheRefreshError(detailsMessage)) {
        setErrorText(t("help.schemaCacheRefreshHint"))
      } else {
        setErrorText(toUserFacingErrorMessage(error, t))
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <AppShell title={t("navigation.help")} pageDescription={t("help.description")}>
      <PageShell>
        <section>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <CardTitle>{t("help.supportChatTitle")}</CardTitle>
                  <CardDescription>{t("help.supportChatDescription")}</CardDescription>
                </div>
                <Button asChild variant="outline" size="sm" className="shrink-0">
                  <Link href="/guide">{t("help.openGuide")}</Link>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{t("help.realtimeHint")}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={statusFilter === "all" ? "default" : "outline"}
                    onClick={() => setStatusFilter("all")}
                  >
                    {t("help.filterAll")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={statusFilter === "open" ? "default" : "outline"}
                    onClick={() => setStatusFilter("open")}
                  >
                    {t("help.filterOpen")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={statusFilter === "closed" ? "default" : "outline"}
                    onClick={() => setStatusFilter("closed")}
                  >
                    {t("help.filterClosed")}
                  </Button>
                </div>
                <Button type="button" size="sm" onClick={() => void handleCreateNewConversation()}>
                  {t("help.createNewConversation")}
                </Button>
              </div>

              {loading ? <p className="text-sm text-muted-foreground">...</p> : null}
              {errorText ? <p className="text-sm text-destructive">{errorText}</p> : null}
              {infoText ? <p className="text-sm text-emerald-700 dark:text-emerald-300">{infoText}</p> : null}

              <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
                <aside className="premium-scrollbar max-h-[620px] space-y-2 overflow-y-auto rounded-xl border border-border/80 bg-muted/15 p-2">
                  {visibleConversations.length === 0 ? (
                    <p className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm text-muted-foreground">
                      {t("help.noConversationsForFilter")}
                    </p>
                  ) : (
                    visibleConversations.map((conversation) => {
                      const preview = lastMessageByConversation[conversation.id]
                      const isActive = conversation.id === activeConversationId
                      return (
                        <button
                          key={conversation.id}
                          type="button"
                          onClick={() => setActiveConversationId(conversation.id)}
                          className={`w-full rounded-lg border p-3 text-left transition-colors ${
                            isActive
                              ? "border-primary/60 bg-primary/5"
                              : "border-border/70 bg-background hover:bg-muted/30"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-medium">
                              {conversation.subject || "Pomoc techniczna"}
                            </p>
                            <Badge variant={isActive ? "default" : "outline"} className="shrink-0">
                              {statusLabel(t, conversation.status)}
                            </Badge>
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {preview?.created_at
                              ? dateLabel(preview.created_at, language)
                              : dateLabel(conversation.updated_at, language)}
                          </p>
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {preview?.body || t("help.emptyStateDescription")}
                          </p>
                        </button>
                      )
                    })
                  )}
                </aside>

                <section className="flex min-h-[460px] flex-col rounded-xl border border-border/80 bg-muted/10">
                  {!activeConversation ? (
                    <div className="grid flex-1 place-items-center p-4 text-sm text-muted-foreground">
                      {t("help.selectConversation")}
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {activeConversation.subject || "Pomoc techniczna"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {activePreview?.created_at
                              ? dateLabel(activePreview.created_at, language)
                              : dateLabel(activeConversation.updated_at, language)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {activeConversation.status === "closed" ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                void handleSetConversationStatus(activeConversation.id, "open")
                              }
                            >
                              {t("help.reopenConversation")}
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                void handleSetConversationStatus(activeConversation.id, "closed")
                              }
                            >
                              {t("help.closeConversation")}
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => void handleDeleteConversation(activeConversation.id)}
                          >
                            {t("help.deleteConversation")}
                          </Button>
                        </div>
                      </div>

                      <div
                        ref={scrollRef}
                        className="premium-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3"
                      >
                        {messages.length === 0 ? (
                          <div className="space-y-1 py-6 text-center text-sm text-muted-foreground">
                            <p>{t("help.emptyStateTitle")}</p>
                            <p>{t("help.emptyStateDescription")}</p>
                          </div>
                        ) : (
                          messages.map((message) => {
                            const senderRole = (
                              message.sender_role ??
                              message.sender_type ??
                              "user"
                            ).toString()
                            const isUser = senderRole === "user"
                            const isSupport = senderRole === "support"
                            return (
                              <div
                                key={message.id}
                                className={
                                  isUser
                                    ? "ml-auto max-w-[88%]"
                                    : isSupport
                                      ? "mr-auto max-w-[88%]"
                                      : "mx-auto max-w-[92%]"
                                }
                              >
                                <div
                                  className={
                                    isUser
                                      ? "rounded-2xl rounded-br-md bg-teal-600 px-3 py-2 text-sm text-white"
                                      : isSupport
                                        ? "rounded-2xl rounded-bl-md border border-border bg-card px-3 py-2 text-sm text-foreground"
                                        : "rounded-xl border border-border/70 bg-muted px-3 py-2 text-center text-sm text-muted-foreground"
                                  }
                                >
                                  <p className="mb-1 text-[0.7rem] opacity-80">
                                    {isUser
                                      ? t("help.youLabel")
                                      : isSupport
                                        ? t("help.supportLabel")
                                        : t("help.systemLabel")}
                                  </p>
                                  <p>{message.body}</p>
                                  <p className="mt-1 text-[0.7rem] opacity-80">
                                    {dateLabel(message.created_at, language)}
                                  </p>
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>

                      <div className="border-t border-border/70 px-3 py-3">
                        {isClosed ? (
                          <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                            <p className="text-sm font-medium">{t("help.closedConversationTitle")}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {closedBySupportConversationIds[activeConversation.id]
                                ? t("help.closedBySupportTitle")
                                : t("help.closedConversationHint")}
                            </p>
                          </div>
                        ) : (
                          <form onSubmit={handleSend} className="flex items-end gap-2">
                            <div className="flex-1">
                              <Label htmlFor="support-message-input" className="sr-only">
                                {t("help.message")}
                              </Label>
                              <Input
                                id="support-message-input"
                                value={draft}
                                onChange={(event) => {
                                  setDraft(event.target.value)
                                  if (errorText) setErrorText(null)
                                  if (infoText) setInfoText(null)
                                }}
                                placeholder={t("help.messagePlaceholder")}
                                disabled={sending}
                              />
                            </div>
                            <Button type="submit" disabled={sending} className="h-10 min-w-24">
                              <Send className="mr-1 size-4" aria-hidden />
                              {t("help.sendMessage")}
                            </Button>
                          </form>
                        )}
                      </div>
                    </>
                  )}
                </section>
              </div>
            </CardContent>
          </Card>
        </section>
      </PageShell>
    </AppShell>
  )
}
