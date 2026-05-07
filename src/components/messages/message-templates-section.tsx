"use client"

import * as React from "react"
import { Check, Pencil } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { useTranslations } from "@/lib/i18n/use-translations"
import { getCurrentBusinessProfileIdForClient } from "@/lib/services/services-store"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import type { Tables } from "@/types/database"

type TemplateType =
  | "reminder_24h"
  | "reminder_before_visit"
  | "booking_confirmation"
  | "booking_cancelled_by_company"
  | "booking_cancelled_by_client"
  | "no_show_follow_up"

type GroupedTemplate = {
  type: TemplateType
  title: string
  smsEnabled: boolean
  emailEnabled: boolean
  smsBody: string
  emailSubject: string
  emailBody: string
  timingMinutesBefore: number | null
  smsRowId: string | null
  emailRowId: string | null
}

const TEMPLATE_ORDER: TemplateType[] = [
  "reminder_24h",
  "reminder_before_visit",
  "booking_confirmation",
  "booking_cancelled_by_company",
  "booking_cancelled_by_client",
  "no_show_follow_up",
]

const TEMPLATE_LABELS: Record<TemplateType, string> = {
  reminder_24h: "Przypomnienie 24h przed wizytą",
  reminder_before_visit: "Przypomnienie przed wizytą",
  booking_confirmation: "Potwierdzenie wizyty",
  booking_cancelled_by_company: "Firma anuluje wizytę",
  booking_cancelled_by_client: "Klient anuluje wizytę",
  no_show_follow_up: "Follow-up po nieobecności klienta",
}

const TEMPLATE_TYPE_ALIASES: Record<TemplateType, string[]> = {
  reminder_24h: ["reminder_24h", "reminder", "first_reminder_24h", "appointment_reminder_24h"],
  reminder_before_visit: ["reminder_before_visit", "second_reminder", "appointment_reminder_short"],
  booking_confirmation: ["booking_confirmation", "confirmation", "booking_confirmed"],
  booking_cancelled_by_company: ["booking_cancelled_by_company", "company_cancelled_booking"],
  booking_cancelled_by_client: ["booking_cancelled_by_client", "client_cancelled_booking"],
  no_show_follow_up: ["no_show_follow_up", "followup_noshow", "follow_up_no_show"],
}

function isMissingMessageTemplatesTableError(message: string | null | undefined): boolean {
  const m = String(message ?? "")
  return (
    /Could not find the table 'public\.message_templates' in the schema cache/i.test(m) ||
    /relation ["']?message_templates["']? does not exist/i.test(m)
  )
}

function defaultTiming(type: TemplateType): number | null {
  if (type === "reminder_24h") return 1440
  if (type === "reminder_before_visit") return 60
  return null
}

function formatTimingLabel(minutes: number | null): string {
  if (minutes == null || Number.isNaN(minutes)) return ""
  const safe = Math.max(0, Math.floor(minutes))
  if (safe === 0) return "0 min"
  const h = Math.floor(safe / 60)
  const min = safe % 60
  if (h > 0 && min > 0) return `${h}h ${min}min`
  if (h > 0) return `${h}h`
  return `${min}min`
}

function parseTimingInput(raw: string): number | null {
  const value = raw.trim().toLowerCase()
  if (!value) return null
  const onlyDigits = value.match(/^\d+$/)
  if (onlyDigits) return Number(onlyDigits[0])
  const normalized = value
    .replace(/godzin(y|a|)?/g, "h")
    .replace(/godz\./g, "h")
    .replace(/minut(y|a|)?/g, "min")
    .replace(/\s+/g, " ")
  const hMatch = normalized.match(/(\d+)\s*h/)
  const mMatch = normalized.match(/(\d+)\s*min/)
  if (!hMatch && !mMatch) return null
  const h = hMatch ? Number(hMatch[1]) : 0
  const m = mMatch ? Number(mMatch[1]) : 0
  return h * 60 + m
}

function toGroupedTemplates(rows: Tables<"message_templates">[]): GroupedTemplate[] {
  return TEMPLATE_ORDER.map((type) => {
    const aliases = TEMPLATE_TYPE_ALIASES[type]
    const matched = rows.filter((row) => aliases.includes(String(row.type)))
    const sms = matched.find((row) => row.channel === "sms")
    const email = matched.find((row) => row.channel === "email")
    const timingSource = (sms ?? email) as (Tables<"message_templates"> & { timing_minutes_before?: number | null }) | undefined
    return {
      type,
      title: TEMPLATE_LABELS[type],
      smsEnabled: sms?.status === "active",
      emailEnabled: email?.status === "active",
      smsBody: sms?.content ?? "",
      emailSubject: email?.title ?? "",
      emailBody: email?.content ?? "",
      timingMinutesBefore:
        typeof timingSource?.timing_minutes_before === "number"
          ? timingSource.timing_minutes_before
          : defaultTiming(type),
      smsRowId: sms?.id ?? null,
      emailRowId: email?.id ?? null,
    }
  })
}

export type MessageTemplatesSectionProps = {
  onRegisterPrimaryAction?: (openCreate: () => void) => void
}

export function MessageTemplatesSection({
  onRegisterPrimaryAction,
}: MessageTemplatesSectionProps) {
  const { t } = useTranslations()
  const [templates, setTemplates] = React.useState<GroupedTemplate[]>([])
  const [businessId, setBusinessId] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [templatesUnavailable, setTemplatesUnavailable] = React.useState(false)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [editingType, setEditingType] = React.useState<TemplateType | null>(null)
  const [form, setForm] = React.useState<GroupedTemplate | null>(null)
  const [showSaved, setShowSaved] = React.useState(false)
  const [timingInput, setTimingInput] = React.useState("")
  const [timingInputError, setTimingInputError] = React.useState<string | null>(null)

  const openCreate = React.useCallback(() => {
    const first = templates[0]
    if (!first) return
    setEditingType(first.type)
    setForm(first)
    setSheetOpen(true)
  }, [templates])

  React.useEffect(() => {
    onRegisterPrimaryAction?.(openCreate)
  }, [onRegisterPrimaryAction, openCreate])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      const client = getBrowserClient()
      if (!client || !isSupabaseConfigured()) {
        if (!cancelled) {
          setTemplates(toGroupedTemplates([]))
          setBusinessId(null)
          setLoadError(null)
          setLoading(false)
        }
        return
      }
      const bid = await getCurrentBusinessProfileIdForClient(client)
      if (!bid) {
        if (!cancelled) {
          setTemplates(toGroupedTemplates([]))
          setBusinessId(null)
          setLoadError("no_business_id")
          setLoading(false)
        }
        return
      }
      const { data, error } = await client
        .from("message_templates")
        .select("*")
        .eq("business_id", bid)
        .order("updated_at", { ascending: false })
      if (cancelled) return
      if (error) {
        if (isMissingMessageTemplatesTableError(error.message)) {
          setTemplatesUnavailable(true)
          setLoadError(null)
          setTemplates(toGroupedTemplates([]))
        } else {
          setLoadError(error.message)
        }
      } else {
        setTemplatesUnavailable(false)
        setLoadError(null)
        setTemplates(toGroupedTemplates((data ?? []) as Tables<"message_templates">[]))
      }
      setBusinessId(bid)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const openEdit = (tpl: GroupedTemplate) => {
    setEditingType(tpl.type)
    setForm(tpl)
    setTimingInput(formatTimingLabel(tpl.timingMinutesBefore))
    setTimingInputError(null)
    setSheetOpen(true)
  }

  const submitForm = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form || !businessId || templatesUnavailable) return
    let submitFormData = form
    if (form.type === "reminder_24h" || form.type === "reminder_before_visit") {
      const parsed = parseTimingInput(timingInput)
      if (parsed == null) {
        setTimingInputError("Podaj czas w formacie np. 24h albo 1h 30min.")
        return
      }
      setTimingInputError(null)
      submitFormData = { ...form, timingMinutesBefore: Math.max(0, parsed) }
    }
    void (async () => {
      const client = getBrowserClient()
      if (!client || !isSupabaseConfigured()) return
      const typeDb = submitFormData.type
      const commonPatch = {
        business_id: businessId,
        type: typeDb as never,
        timing_minutes_before: submitFormData.timingMinutesBefore,
      }
      const smsPayload = {
        ...commonPatch,
        channel: "sms",
        title: submitFormData.title,
        content: submitFormData.smsBody,
        status: submitFormData.smsEnabled ? "active" : "draft",
      }
      const emailPayload = {
        ...commonPatch,
        channel: "email",
        title: submitFormData.emailSubject || submitFormData.title,
        content: submitFormData.emailBody,
        status: submitFormData.emailEnabled ? "active" : "draft",
      }
      if (submitFormData.smsRowId) {
        const res = await client
          .from("message_templates")
          .update(smsPayload as never)
          .eq("id", submitFormData.smsRowId)
        if (res.error && isMissingMessageTemplatesTableError(res.error.message)) {
          setTemplatesUnavailable(true)
          setLoadError(null)
          setSheetOpen(false)
          return
        }
      } else {
        const res = await client.from("message_templates").insert(smsPayload as never)
        if (res.error && isMissingMessageTemplatesTableError(res.error.message)) {
          setTemplatesUnavailable(true)
          setLoadError(null)
          setSheetOpen(false)
          return
        }
      }
      if (submitFormData.emailRowId) {
        const res = await client
          .from("message_templates")
          .update(emailPayload as never)
          .eq("id", submitFormData.emailRowId)
        if (res.error && isMissingMessageTemplatesTableError(res.error.message)) {
          setTemplatesUnavailable(true)
          setLoadError(null)
          setSheetOpen(false)
          return
        }
      } else {
        const res = await client.from("message_templates").insert(emailPayload as never)
        if (res.error && isMissingMessageTemplatesTableError(res.error.message)) {
          setTemplatesUnavailable(true)
          setLoadError(null)
          setSheetOpen(false)
          return
        }
      }
      setTemplates((prev) =>
        prev.map((row) => (row.type === submitFormData.type ? submitFormData : row)),
      )
      setShowSaved(true)
      setSheetOpen(false)
    })()
  }

  return (
    <>
      <section aria-labelledby="messages-templates-heading" className="min-w-0">
        <h2
          id="messages-templates-heading"
          className="mb-3 text-base font-semibold text-foreground"
        >
          {t("messages.sectionTemplates")}
        </h2>

        {showSaved ? (
          <div
            role="status"
            className="mb-3 flex items-center gap-2 rounded-md border border-success/25 bg-success/10 px-3 py-2 text-sm text-[#14532D]"
          >
            <Check className="size-4 shrink-0 text-success" aria-hidden />
            {t("messages.savedBanner")}
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">{t("messagesLog.loading")}</p>
        ) : loadError ? (
          <p className="text-sm text-destructive">{loadError}</p>
        ) : (
          <div className="mt-2 grid min-w-0 gap-2 md:grid-cols-2">
            {templatesUnavailable ? (
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
                Szablony wiadomości są tymczasowo niedostępne (brak tabeli `message_templates` w bazie). Panel działa bez błędu, ale edycja szablonów jest wyłączona do czasu migracji.
              </p>
            ) : null}
            {templates.map((row) => (
              <Card key={row.type} className="rounded-xl border border-border bg-card shadow-sm shadow-slate-900/5">
                <CardHeader className="space-y-1 px-4 py-3">
                  <CardTitle className="text-[13px] leading-snug">{row.title}</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 pt-0">
                  <p className="text-[11px] text-muted-foreground">
                    SMS: {row.smsEnabled ? "on" : "off"} · E-mail: {row.emailEnabled ? "on" : "off"}
                    {row.timingMinutesBefore != null ? ` · ${formatTimingLabel(row.timingMinutesBefore)}` : ""}
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => openEdit(row)}
                      disabled={templatesUnavailable}
                      className="h-8 rounded-lg px-2.5 text-xs"
                    >
                      <Pencil className="size-3" />
                      Edytuj
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col overflow-hidden border-border/80 bg-card p-0 sm:max-w-xl"
          showCloseButton
        >
          <SheetHeader className="space-y-1 border-b border-border/70 px-6 py-6 text-left">
            <SheetTitle className="font-heading text-xl">
              {editingType ? TEMPLATE_LABELS[editingType] : "Szablon"}
            </SheetTitle>
          </SheetHeader>
          <form
            onSubmit={submitForm}
            className="premium-scrollbar flex flex-1 flex-col overflow-x-hidden overflow-y-auto"
          >
            <div className="flex-1 space-y-5 px-6 py-6">
              <div className="space-y-2 rounded-xl border border-border p-3">
                <Label className="font-medium">Kanał SMS</Label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(form?.smsEnabled)}
                    onChange={(e) => setForm((prev) => (prev ? { ...prev, smsEnabled: e.target.checked } : prev))}
                  />
                  Aktywny
                </label>
                <Textarea
                  rows={6}
                  value={form?.smsBody ?? ""}
                  onChange={(e) => setForm((prev) => (prev ? { ...prev, smsBody: e.target.value } : prev))}
                  placeholder="Treść SMS"
                />
              </div>
              <div className="space-y-2 rounded-xl border border-border p-3">
                <Label className="font-medium">Kanał E-mail</Label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(form?.emailEnabled)}
                    onChange={(e) => setForm((prev) => (prev ? { ...prev, emailEnabled: e.target.checked } : prev))}
                  />
                  Aktywny
                </label>
                <Input
                  value={form?.emailSubject ?? ""}
                  onChange={(e) => setForm((prev) => (prev ? { ...prev, emailSubject: e.target.value } : prev))}
                  placeholder="Temat e-maila"
                />
                <Textarea
                  rows={8}
                  value={form?.emailBody ?? ""}
                  onChange={(e) => setForm((prev) => (prev ? { ...prev, emailBody: e.target.value } : prev))}
                  placeholder="Treść e-maila"
                />
              </div>
              {form?.type === "reminder_24h" || form?.type === "reminder_before_visit" ? (
                <div className="space-y-2">
                  <Label>Wyślij ile czasu przed wizytą</Label>
                  <Input
                    type="text"
                    value={timingInput}
                    onChange={(e) => {
                      const next = e.target.value
                      setTimingInput(next)
                      const parsed = parseTimingInput(next)
                      if (parsed == null) {
                        setTimingInputError("Użyj formatu np. 24h albo 1h 30min.")
                        return
                      }
                      setTimingInputError(null)
                      setForm((prev) => (prev ? { ...prev, timingMinutesBefore: Math.max(0, parsed) } : prev))
                    }}
                    placeholder="np. 24h lub 1h 30min"
                  />
                  {timingInputError ? (
                    <p className="text-xs text-destructive">{timingInputError}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Obsługiwane formaty: `24h`, `1h 30min`, `90min`.
                    </p>
                  )}
                </div>
              ) : null}
              <div className="text-xs text-muted-foreground">
                Dostępne zmienne: {"{{imie}}"}, {"{{data}}"}, {"{{godzina}}"}, {"{{usluga}}"}, {"{{osoba}}"}, {"{{link_rezerwacji}}"}, {"{{link_potwierdzenia}}"}, {"{{link_anulowania}}"}, {"{{telefon_firmy}}"}, {"{{nazwa_firmy}}"}
              </div>
            </div>
            <div className="mt-auto flex items-center justify-end gap-2 border-t border-border/70 bg-muted/20 px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>
                Anuluj
              </Button>
              <Button type="submit" disabled={templatesUnavailable}>
                Zapisz szablon
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  )
}
