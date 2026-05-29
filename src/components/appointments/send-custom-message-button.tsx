"use client"

import * as React from "react"
import { Send } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useBusinessAccess } from "@/lib/auth/business-access-context"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import type { Tables } from "@/types/database"

type ManualTemplate = Pick<Tables<"custom_templates">, "id" | "name">

export type SendCustomMessageButtonProps = {
  /** UI id wizyty (np. „sb-<uuid>"). */
  appointmentId: string
}

/**
 * Ręczna wysyłka własnego szablonu („wyślij teraz") z poziomu wizyty.
 * Sam pobiera listę szablonów `trigger_type='manual'` (RLS firmy).
 */
export function SendCustomMessageButton({ appointmentId }: SendCustomMessageButtonProps) {
  const { ready, businessId } = useBusinessAccess()
  const [templates, setTemplates] = React.useState<ManualTemplate[]>([])
  const [loaded, setLoaded] = React.useState(false)
  const [status, setStatus] = React.useState<string | null>(null)
  const [sendingId, setSendingId] = React.useState<string | null>(null)

  const loadTemplates = React.useCallback(async () => {
    if (!ready || !businessId || !isSupabaseConfigured()) {
      setLoaded(true)
      return
    }
    const client = getBrowserClient()
    if (!client) {
      setLoaded(true)
      return
    }
    const { data } = await client
      .from("custom_templates")
      .select("id,name")
      .eq("business_id", businessId)
      .eq("trigger_type", "manual")
      .eq("status", "active")
      .order("updated_at", { ascending: false })
    setTemplates((data ?? []) as ManualTemplate[])
    setLoaded(true)
  }, [ready, businessId])

  const send = (templateId: string) => {
    setSendingId(templateId)
    setStatus(null)
    void (async () => {
      try {
        const res = await fetch("/api/bookings/send-custom-now", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId: appointmentId, customTemplateId: templateId }),
        })
        const json = (await res.json().catch(() => null)) as
          | { ok?: boolean; outcomes?: Array<{ status: string }>; reason?: string }
          | null
        if (res.ok && json?.ok) {
          if (json.reason === "no_channel_or_contact") {
            setStatus("Brak kanału lub kontaktu klienta.")
          } else {
            const sent = (json.outcomes ?? []).filter((o) => o.status === "sent").length
            setStatus(sent > 0 ? "Wysłano." : "Nie udało się wysłać.")
          }
        } else {
          setStatus("Nie udało się wysłać.")
        }
      } catch {
        setStatus("Błąd wysyłki.")
      } finally {
        setSendingId(null)
      }
    })()
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <DropdownMenu
        onOpenChange={(open) => {
          if (open && !loaded) void loadTemplates()
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="default"
            className="h-9 w-auto shrink-0 select-none justify-center gap-1.5 rounded-xl whitespace-nowrap"
          >
            <Send className="size-3.5" aria-hidden />
            Wyślij wiadomość
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {!loaded ? (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">Wczytywanie…</div>
          ) : templates.length === 0 ? (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              Brak szablonów ręcznych. Dodaj szablon z wyzwalaczem „ręczny” w Wiadomościach.
            </div>
          ) : (
            templates.map((tpl) => (
              <DropdownMenuItem
                key={tpl.id}
                disabled={sendingId !== null}
                onSelect={(e) => {
                  e.preventDefault()
                  send(tpl.id)
                }}
              >
                {tpl.name || "Bez nazwy"}
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {status ? <span className="text-[11px] text-muted-foreground">{status}</span> : null}
    </div>
  )
}
