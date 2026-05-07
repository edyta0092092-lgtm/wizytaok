"use client"

import * as React from "react"
import { Send } from "lucide-react"
import type { RealtimeChannel } from "@supabase/supabase-js"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useTranslations } from "@/lib/i18n/use-translations"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import type { Tables } from "@/types/database"

type SupportConversation = Tables<"support_conversations">
type SupportMessage = Tables<"support_messages">

type ConversationListItem = {
  conversation: SupportConversation
  businessName: string
  businessEmail: string
  businessPhone: string
  lastMessage: string
}

function parseSupportAdminEmails(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
}

function formatDt(value: string, lang: "pl" | "en"): string {
  return new Intl.DateTimeFormat(lang === "en" ? "en-US" : "pl-PL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value))
}

export default function SupportPage() {
  const { t, language } = useTranslations()
  const [loading, setLoading] = React.useState(true)
  const [allowed, setAllowed] = React.useState(false)
  const [meUserId, setMeUserId] = React.useState<string | null>(null)
  const [items, setItems] = React.useState<ConversationListItem[]>([])
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [messages, setMessages] = React.useState<SupportMessage[]>([])
  const [draft, setDraft] = React.useState("")
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<"all" | "open" | "closed">("all")
  const [meEmail, setMeEmail] = React.useState<string | null>(null)
  const [errorText, setErrorText] = React.useState<string | null>(null)
  const [sending, setSending] = React.useState(false)
  const [accessHint, setAccessHint] = React.useState<string | null>(null)
  const channelRef = React.useRef<RealtimeChannel | null>(null)
  const scrollRef = React.useRef<HTMLDivElement | null>(null)

  const active = React.useMemo(() => items.find((x) => x.conversation.id === activeId) ?? null, [items, activeId])
  const visibleItems = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((item) => {
      if (statusFilter !== "all" && item.conversation.status !== statusFilter) return false
      if (!q) return true
      return (
        item.businessName.toLowerCase().includes(q) ||
        item.businessEmail.toLowerCase().includes(q) ||
        item.lastMessage.toLowerCase().includes(q)
      )
    })
  }, [items, search, statusFilter])

  const loadMessages = React.useCallback(async (conversationId: string) => {
    const client = getBrowserClient()
    if (!client) return
    const { data, error } = await client
      .from("support_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
    if (error) throw error
    setMessages((data ?? []) as SupportMessage[])
  }, [])

  const loadConversations = React.useCallback(async () => {
    const client = getBrowserClient()
    if (!client) return
    const { data: convRows, error: convErr } = await client
      .from("support_conversations")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(200)
    if (convErr) throw convErr
    const conversations = (convRows ?? []) as SupportConversation[]
    if (conversations.length === 0) {
      setItems([])
      setActiveId(null)
      setMessages([])
      return
    }
    const businessIds = Array.from(new Set(conversations.map((x) => x.business_id).filter(Boolean))) as string[]
    const conversationIds = conversations.map((x) => x.id)
    const [{ data: bpRows }, { data: msgRows }] = await Promise.all([
      businessIds.length > 0
        ? client.from("business_profiles").select("id,business_name,email,phone").in("id", businessIds)
        : Promise.resolve({ data: [] as Array<{ id: string; business_name: string; email?: string | null; phone?: string | null }>, error: null }),
      client
        .from("support_messages")
        .select("conversation_id,body,created_at")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false }),
    ])
    const businessById = new Map<string, { name: string; email: string; phone: string }>()
    for (const row of bpRows ?? []) {
      const businessName = String((row as { business_name?: string | null }).business_name ?? "").trim()
      const email = String((row as { email?: string | null }).email ?? "").trim()
      const phone = String((row as { phone?: string | null }).phone ?? "").trim()
      const fallbackName = businessName || email || (language === "en" ? "Unnamed company" : "Firma bez nazwy")
      businessById.set(String(row.id), {
        name: fallbackName,
        email,
        phone,
      })
    }
    const lastByConversation = new Map<string, string>()
    for (const row of msgRows ?? []) {
      const cid = String(row.conversation_id ?? "")
      if (!cid || lastByConversation.has(cid)) continue
      lastByConversation.set(cid, String(row.body ?? ""))
    }
    const nextItems: ConversationListItem[] = conversations.map((conversation) => ({
      conversation,
      businessName: businessById.get(String(conversation.business_id ?? ""))?.name || "-",
      businessEmail: businessById.get(String(conversation.business_id ?? ""))?.email || "",
      businessPhone: businessById.get(String(conversation.business_id ?? ""))?.phone || "",
      lastMessage: lastByConversation.get(conversation.id) || "",
    }))
    setItems(nextItems)
    const nextActiveId =
      (activeId && nextItems.some((x) => x.conversation.id === activeId) ? activeId : nextItems[0]?.conversation.id) ?? null
    setActiveId(nextActiveId)
    if (nextActiveId) {
      await loadMessages(nextActiveId)
    } else {
      setMessages([])
    }
  }, [activeId, language, loadMessages])

  React.useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        const client = getBrowserClient()
        if (!client || !isSupabaseConfigured()) {
          setAllowed(false)
          return
        }
        const { data: auth } = await client.auth.getUser()
        const user = auth.user
        const email = user?.email?.toLowerCase().trim() ?? ""
        const allowedEmails = parseSupportAdminEmails(process.env.NEXT_PUBLIC_SUPPORT_ADMIN_EMAILS)
        const envAllowed = Boolean(email && allowedEmails.includes(email))
        const envConfigured = allowedEmails.length > 0
        let tableAllowed = false
        if (user?.id) {
          const orParts = [`user_id.eq.${user.id}`]
          if (email) orParts.push(`email.eq.${email}`)
          const { data: adminRow } = await client
            .from("support_admins")
            .select("id")
            .eq("is_active", true)
            .or(orParts.join(","))
            .limit(1)
            .maybeSingle()
          tableAllowed = Boolean(adminRow?.id)
        }
        const canUse = envAllowed || tableAllowed
        console.info("[support.access]", {
          userEmail: email || null,
          allowedEmails,
          isSupportAdmin: canUse,
        })
        if (!envConfigured && process.env.NODE_ENV !== "production") {
          setAccessHint(t("supportPanel.missingAdminConfig"))
        } else {
          setAccessHint(null)
        }
        setAllowed(canUse)
        setMeUserId(user?.id ?? null)
        setMeEmail(user?.email ?? null)
        if (!canUse) return
        await loadConversations()
      } finally {
        setLoading(false)
      }
    })()
  }, [loadConversations, t])

  React.useEffect(() => {
    if (!allowed || !isSupabaseConfigured()) return
    const client = getBrowserClient()
    if (!client) return
    const channel = client
      .channel("support:conversations:list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_conversations" },
        () => {
          void loadConversations()
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages" },
        () => {
          void loadConversations()
        }
      )
      .subscribe()
    return () => {
      void client.removeChannel(channel)
    }
  }, [allowed, loadConversations])

  React.useEffect(() => {
    if (!activeId || !isSupabaseConfigured()) return
    const client = getBrowserClient()
    if (!client) return
    if (channelRef.current) void client.removeChannel(channelRef.current)
    const channel = client
      .channel(`support:messages:${activeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `conversation_id=eq.${activeId}`,
        },
        (payload) => {
          const message = payload.new as SupportMessage
          setMessages((prev) => (prev.some((x) => x.id === message.id) ? prev : [...prev, message]))
          void loadConversations()
        }
      )
      .subscribe()
    channelRef.current = channel
    return () => {
      void client.removeChannel(channel)
      if (channelRef.current === channel) channelRef.current = null
    }
  }, [activeId, loadConversations])

  React.useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  const setStatus = async (status: "open" | "closed") => {
    if (!activeId) return
    const client = getBrowserClient()
    if (!client) return
    const { error } = await client.from("support_conversations").update({ status }).eq("id", activeId)
    if (error) {
      setErrorText(error.message)
      return
    }
    setItems((prev) =>
      prev.map((x) => (x.conversation.id === activeId ? { ...x, conversation: { ...x.conversation, status } } : x))
    )
  }

  const sendSupportReply = async (e: React.FormEvent) => {
    e.preventDefault()
    const body = draft.trim()
    if (!body || !active || !meUserId || !active.conversation.business_id) return
    setSending(true)
    setErrorText(null)
    try {
      const client = getBrowserClient()
      if (!client) return
      const { data, error } = await client
        .from("support_messages")
        .insert({
          conversation_id: active.conversation.id,
          business_id: active.conversation.business_id,
          sender_user_id: meUserId,
          sender_role: "support",
          body,
        })
        .select("*")
        .single()
      if (error) throw error
      const row = data as SupportMessage
      setMessages((prev) => (prev.some((x) => x.id === row.id) ? prev : [...prev, row]))
      setDraft("")
      if (active.conversation.status === "closed") {
        await setStatus("open")
      }
      await loadConversations()
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : String(error))
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <div className="border-b border-slate-800 px-6 py-4">
          <h1 className="text-lg font-semibold">{t("supportPanel.title")}</h1>
        </div>
        <div className="p-6 text-sm text-slate-400">...</div>
      </div>
    )
  }

  if (!allowed) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <header className="border-b border-slate-800 px-6 py-4">
          <h1 className="text-lg font-semibold">{t("supportPanel.title")}</h1>
          <p className="text-sm text-slate-400">{t("supportPanel.description")}</p>
        </header>
        <main className="grid min-h-[calc(100vh-73px)] place-items-center px-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-6 py-5 text-center">
            <p className="text-sm font-medium text-white">{language === "en" ? "No access." : "Brak dostępu."}</p>
            {accessHint ? <p className="mt-2 max-w-xl text-xs text-slate-400">{accessHint}</p> : null}
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold">{t("supportPanel.title")}</h1>
            <p className="text-sm text-slate-400">{t("supportPanel.description")}</p>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-xs text-slate-400">{meEmail || "-"}</p>
            <Button
              type="button"
              variant="outline"
              className="h-8 border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
              onClick={() => {
                const client = getBrowserClient()
                void client?.auth.signOut().then(() => {
                  window.location.href = "/login"
                })
              }}
            >
              {language === "en" ? "Log out" : "Wyloguj"}
            </Button>
          </div>
        </div>
      </header>

      <main className="grid h-[calc(100vh-73px)] grid-cols-1 md:grid-cols-[360px_1fr]">
        <aside className="border-r border-slate-800 p-4">
          <div className="mb-3">
            <h2 className="text-sm font-semibold">{t("supportPanel.conversations")}</h2>
          </div>
          <div className="mb-3 space-y-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={language === "en" ? "Search company or email..." : "Szukaj firmy lub e-mail..."}
              className="border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={statusFilter === "all" ? "default" : "outline"}
                onClick={() => setStatusFilter("all")}
              >
                {language === "en" ? "All" : "Wszystkie"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={statusFilter === "open" ? "default" : "outline"}
                onClick={() => setStatusFilter("open")}
              >
                {t("help.statusOpen")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={statusFilter === "closed" ? "default" : "outline"}
                onClick={() => setStatusFilter("closed")}
              >
                {t("help.statusClosed")}
              </Button>
            </div>
          </div>
          <div className="premium-scrollbar max-h-[calc(100vh-210px)] space-y-2 overflow-y-auto pr-1">
            {visibleItems.length === 0 ? (
              <div className="space-y-1 text-sm text-slate-400">
                <p>{language === "en" ? "No conversations." : "Brak rozmów."}</p>
                <p className="text-xs">
                  {language === "en"
                    ? "New messages from the Help panel will appear here."
                    : "Nowe wiadomości z panelu Pomoc pojawią się tutaj."}
                </p>
              </div>
            ) : (
              visibleItems.map((item) => (
                <button
                  key={item.conversation.id}
                  type="button"
                  onClick={() => {
                    setActiveId(item.conversation.id)
                    void loadMessages(item.conversation.id)
                  }}
                  className={`w-full rounded-xl border p-3 text-left ${activeId === item.conversation.id ? "border-teal-500 bg-slate-900" : "border-slate-800 bg-slate-900/60"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{item.businessName}</p>
                    <Badge variant="outline" className="border-slate-700 text-[10px]">
                      {item.conversation.status === "closed" ? t("help.statusClosed") : t("help.statusOpen")}
                    </Badge>
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-400">{item.businessEmail || "-"}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-400">{item.lastMessage || "-"}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{formatDt(item.conversation.updated_at, language)}</p>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col p-4">
          {active ? (
            <>
              <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{active.businessName}</p>
                  <p className="truncate text-xs text-slate-400">
                    {t("supportPanel.contactEmail")}: {active.businessEmail || "-"} · {t("supportPanel.contactPhone")}: {active.businessPhone || "-"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-slate-700">
                    {active.conversation.status === "closed" ? t("help.statusClosed") : t("help.statusOpen")}
                  </Badge>
                  <Button
                    size="sm"
                    type="button"
                    className="bg-slate-800 text-slate-100 hover:bg-slate-700"
                    onClick={() => void setStatus(active.conversation.status === "closed" ? "open" : "closed")}
                  >
                    {active.conversation.status === "closed" ? t("supportPanel.reopen") : t("supportPanel.close")}
                  </Button>
                </div>
              </div>

              {errorText ? <p className="mb-2 text-sm text-rose-400">{errorText}</p> : null}

              <div
                ref={scrollRef}
                className="premium-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/40 p-3"
              >
                {messages.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-400">{t("supportPanel.emptyMessages")}</p>
                ) : (
                  messages.map((message) => {
                    const role = (message.sender_role ?? "user").toString()
                    const isSupport = role === "support"
                    return (
                      <div key={message.id} className={isSupport ? "ml-auto max-w-[88%]" : "mr-auto max-w-[88%]"}>
                        <div className={isSupport ? "rounded-2xl rounded-br-md bg-teal-600 px-3 py-2 text-sm text-white" : "rounded-2xl rounded-bl-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"}>
                          <p className="mb-1 text-[0.7rem] opacity-80">{isSupport ? t("help.supportLabel") : t("supportPanel.clientLabel")}</p>
                          <p className="whitespace-pre-wrap">{message.body}</p>
                          <p className="mt-1 text-[0.7rem] opacity-80">{formatDt(message.created_at, language)}</p>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              <form onSubmit={sendSupportReply} className="mt-3 flex items-end gap-2">
                <div className="flex-1">
                  <Label htmlFor="support-reply" className="sr-only">
                    {t("supportPanel.reply")}
                  </Label>
                  <Textarea
                    id="support-reply"
                    value={draft}
                    rows={3}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        if (!sending) {
                          const form = e.currentTarget.form
                          form?.requestSubmit()
                        }
                      }
                    }}
                    placeholder={t("supportPanel.replyPlaceholder")}
                    disabled={sending}
                    className="border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500"
                  />
                </div>
                <Button type="submit" disabled={sending || !draft.trim()} className="bg-teal-600 text-white hover:bg-teal-500">
                  <Send className="mr-1 size-4" /> {t("supportPanel.sendReply")}
                </Button>
              </form>
            </>
          ) : (
            <div className="grid h-full place-items-center rounded-xl border border-slate-800 bg-slate-900/40">
              <p className="text-sm text-slate-400">{t("supportPanel.selectConversation")}</p>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

