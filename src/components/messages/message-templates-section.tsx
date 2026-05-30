"use client"

import * as React from "react"
import { Check, ChevronDown, Pencil } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useTranslations } from "@/lib/i18n/use-translations"
import { cn } from "@/lib/utils"
import { useBusinessAccess } from "@/lib/auth/business-access-context"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import type { Tables } from "@/types/database"

type TemplateType =
  | "reminder_24h"
  | "reminder_before_visit"
  | "booking_confirmation"
  | "booking_cancelled_by_company"
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

type ReminderTimingDefaults = {
  firstReminderMinutes: number
  secondReminderMinutes: number
}

const TEMPLATE_ORDER: TemplateType[] = [
  "reminder_24h",
  "reminder_before_visit",
  "booking_confirmation",
  "booking_cancelled_by_company",
  "no_show_follow_up",
]

const TEMPLATE_LABELS: Record<TemplateType, string> = {
  reminder_24h: "Przypomnienie 24h przed wizytą",
  reminder_before_visit: "Przypomnienie przed wizytą",
  booking_confirmation: "Potwierdzenie wizyty",
  booking_cancelled_by_company: "Anulowanie wizyty",
  no_show_follow_up: "Follow-up po nieobecności klienta",
}

const TEMPLATE_TYPE_ALIASES: Record<TemplateType, string[]> = {
  reminder_24h: ["reminder_24h", "reminder", "first_reminder_24h", "appointment_reminder_24h"],
  reminder_before_visit: ["reminder_before_visit", "second_reminder", "appointment_reminder_short"],
  booking_confirmation: ["booking_confirmation", "confirmation", "booking_confirmed", "booking_created"],
  booking_cancelled_by_company: [
    "booking_cancelled_by_company",
    "company_cancelled_booking",
    "booking_cancelled_by_client",
    "client_cancelled_booking",
  ],
  no_show_follow_up: ["no_show_follow_up", "followup_noshow", "follow_up_no_show"],
}

function fallbackEnabledWhenNoTemplate(type: TemplateType): { sms: boolean; email: boolean } {
  // Domyślnie WŁĄCZONE (firma może wyłączyć): przypomnienia, potwierdzenie,
  // anulowanie. Follow-up po nieobecności jest domyślnie wyłączony i firma musi
  // sama go włączyć. Stany muszą zgadzać się z bramkowaniem wysyłki na serwerze.
  if (type === "no_show_follow_up") {
    return { sms: false, email: false }
  }
  return { sms: true, email: true }
}

const TEMPLATE_DEFAULT_CONTENT: Record<
  TemplateType,
  { smsBody: string; emailSubject: string; emailBody: string }
> = {
  reminder_24h: {
    smsBody:
      "Cześć {{imie}}, przypominamy o Twojej wizycie jutro o {{godzina}} ({{usluga}}). Adres: {{adres_firmy}}. Zarządzaj wizytą: {{link_potwierdzenia}}",
    emailSubject: "Przypomnienie o wizycie jutro",
    emailBody: `Cześć {{imie}},

przypominamy o Twojej wizycie:
- Data: {{data}}
- Godzina: {{godzina}}
- Usługa: {{usluga}}
- Osoba: {{osoba}}
- Adres: {{adres_firmy}}

Zarządzaj wizytą (możesz też anulować wizytę, jeśli nie możesz przyjść):
{{link_potwierdzenia}}

Pozdrawiamy,
{{nazwa_firmy}}`,
  },
  reminder_before_visit: {
    smsBody:
      "Cześć {{imie}}, przypominamy o dzisiejszej wizycie o {{godzina}} ({{usluga}}). Adres: {{adres_firmy}}. Do zobaczenia!",
    emailSubject: "Przypomnienie o dzisiejszej wizycie",
    emailBody: `Cześć {{imie}},

to krótkie przypomnienie o Twojej dzisiejszej wizycie:
- Godzina: {{godzina}}
- Usługa: {{usluga}}
- Osoba: {{osoba}}
- Adres: {{adres_firmy}}

Do zobaczenia,
{{nazwa_firmy}}`,
  },
  booking_confirmation: {
    smsBody:
      "Wizyta potwierdzona: {{usluga}}, {{data}} o {{godzina}}. Adres: {{adres_firmy}}. Zarządzaj wizytą lub anuluj ją tutaj: {{link_potwierdzenia}}",
    emailSubject: "Wizyta potwierdzona",
    emailBody: `Cześć {{imie}},

Twoja wizyta została potwierdzona.

Szczegóły wizyty:
- Usługa: {{usluga}}
- Termin: {{data}} o {{godzina}}
- Klient: {{imie}}
- Adres: {{adres_firmy}}

Zarządzaj wizytą:
{{link_potwierdzenia}}

Pod tym linkiem możesz sprawdzić szczegóły wizyty lub anulować wizytę, jeśli nie możesz przyjść.

Pozdrawiamy,
{{nazwa_firmy}}`,
  },
  booking_cancelled_by_company: {
    smsBody: "Wizyta odwołana: {{usluga}}, {{data}} o {{godzina}}.",
    emailSubject: "Wizyta odwołana",
    emailBody: `Twoja wizyta została odwołana.

Anulowany termin:
- Data: {{data}}
- Godzina: {{godzina}}
- Usługa: {{usluga}}

Nową wizytę możesz umówić tutaj:
{{link_rezerwacji}}

W razie pytań: {{telefon_firmy}}

Pozdrawiamy,
{{nazwa_firmy}}`,
  },
  no_show_follow_up: {
    smsBody:
      "Cześć {{imie}}, nie odnotowaliśmy Twojej wizyty {{data}} o {{godzina}}. Umów nowy termin: {{link_rezerwacji}}",
    emailSubject: "Nowy termin po nieobecności",
    emailBody: `Cześć {{imie}},

nie odnotowaliśmy Twojej wizyty:
- Data: {{data}}
- Godzina: {{godzina}}
- Usługa: {{usluga}}

Jeśli chcesz, możesz od razu umówić nowy termin:
{{link_rezerwacji}}

Pozdrawiamy,
{{nazwa_firmy}}`,
  },
}

function isMissingMessageTemplatesTableError(message: string | null | undefined): boolean {
  const m = String(message ?? "")
  return (
    /Could not find the table 'public\.message_templates' in the schema cache/i.test(m) ||
    /relation ["']?message_templates["']? does not exist/i.test(m)
  )
}

function defaultTiming(type: TemplateType, defaults: ReminderTimingDefaults): number | null {
  if (type === "reminder_24h") return defaults.firstReminderMinutes
  if (type === "reminder_before_visit") return defaults.secondReminderMinutes
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

function NativeSelect({
  value,
  onChange,
  className,
  children,
}: {
  value: string
  onChange: (value: string) => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("relative", className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full appearance-none rounded-xl border border-input bg-card pl-3 pr-9 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 dark:bg-input/20"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}

const REMINDER_TIMING_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 15, label: "15 min przed" },
  { value: 30, label: "30 min przed" },
  { value: 60, label: "1 godzina przed" },
  { value: 120, label: "2 godziny przed" },
  { value: 180, label: "3 godziny przed" },
  { value: 360, label: "6 godzin przed" },
  { value: 720, label: "12 godzin przed" },
  { value: 1440, label: "24 godziny przed" },
  { value: 2880, label: "48 godzin przed" },
]

function withReadyContent(tpl: GroupedTemplate): GroupedTemplate {
  const defaults = TEMPLATE_DEFAULT_CONTENT[tpl.type]
  return {
    ...tpl,
    smsBody: tpl.smsBody.trim() || defaults.smsBody,
    emailSubject: tpl.emailSubject.trim() || defaults.emailSubject,
    emailBody: tpl.emailBody.trim() || defaults.emailBody,
  }
}

function reminder24hTitleFromMinutes(minutes: number | null): string {
  const safe = typeof minutes === "number" && Number.isFinite(minutes) ? Math.max(0, Math.floor(minutes)) : 1440
  if (safe > 0 && safe % 60 === 0) {
    return `Przypomnienie ${Math.floor(safe / 60)}h przed wizytą`
  }
  return `Przypomnienie ${formatTimingLabel(safe)} przed wizytą`
}

function toGroupedTemplates(rows: Tables<"message_templates">[], defaults: ReminderTimingDefaults): GroupedTemplate[] {
  const normalizeType = (value: string | null | undefined) => String(value ?? "").trim().toLowerCase()
  const pickChannelRow = (
    matchedRows: Tables<"message_templates">[],
    type: TemplateType,
    channel: "sms" | "email",
  ): Tables<"message_templates"> | undefined => {
    const typeNorm = normalizeType(type)
    const primary = matchedRows.find(
      (row) => normalizeType(row.type) === typeNorm && row.channel === channel,
    )
    if (primary) return primary
    return matchedRows.find((row) => row.channel === channel)
  }

  return TEMPLATE_ORDER.map((type) => {
    const aliases = TEMPLATE_TYPE_ALIASES[type]
    const matched = rows.filter((row) => aliases.includes(String(row.type)))
    const sms = pickChannelRow(matched, type, "sms")
    const email = pickChannelRow(matched, type, "email")
    const fallbackEnabled = fallbackEnabledWhenNoTemplate(type)
    const timingSource = (sms ?? email) as (Tables<"message_templates"> & { timing_minutes_before?: number | null }) | undefined
    const timingMinutesBefore =
      typeof timingSource?.timing_minutes_before === "number"
        ? timingSource.timing_minutes_before
        : defaultTiming(type, defaults)
    const title =
      type === "reminder_24h"
        ? reminder24hTitleFromMinutes(timingMinutesBefore)
        : TEMPLATE_LABELS[type]
    return {
      type,
      title,
      smsEnabled: sms ? sms.status === "active" : fallbackEnabled.sms,
      emailEnabled: email ? email.status === "active" : fallbackEnabled.email,
      smsBody: sms?.content ?? "",
      emailSubject: email?.title ?? "",
      emailBody: email?.content ?? "",
      timingMinutesBefore,
      smsRowId: sms?.id ?? null,
      emailRowId: email?.id ?? null,
    }
  })
}

export type MessageTemplatesSectionProps = {
  onRegisterPrimaryAction?: (openCreate: () => void) => void
  readOnly?: boolean
}

export function MessageTemplatesSection({
  onRegisterPrimaryAction,
  readOnly = false,
}: MessageTemplatesSectionProps) {
  const { t } = useTranslations()
  const { ready: accessReady, businessId: accessBusinessId } = useBusinessAccess()
  const [templates, setTemplates] = React.useState<GroupedTemplate[]>([])
  const [businessId, setBusinessId] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [templatesUnavailable, setTemplatesUnavailable] = React.useState(false)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [editingType, setEditingType] = React.useState<TemplateType | null>(null)
  const [form, setForm] = React.useState<GroupedTemplate | null>(null)
  const [showSaved, setShowSaved] = React.useState(false)
  const [saveError, setSaveError] = React.useState<string | null>(null)

  const openCreate = React.useCallback(() => {
    if (readOnly) return
    const first = templates[0]
    if (!first) return
    setEditingType(first.type)
    setForm(first)
    setSheetOpen(true)
  }, [templates, readOnly])

  React.useEffect(() => {
    onRegisterPrimaryAction?.(openCreate)
  }, [onRegisterPrimaryAction, openCreate])

  React.useEffect(() => {
    if (!accessReady) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      const client = getBrowserClient()
      const bid = accessBusinessId
      if (!client || !isSupabaseConfigured() || !bid) {
        if (!cancelled) {
          setTemplates(
            toGroupedTemplates([], { firstReminderMinutes: 24 * 60, secondReminderMinutes: 120 }),
          )
          setBusinessId(null)
          setLoadError(null)
          setLoading(false)
        }
        return
      }
      const [{ data, error }, { data: profileData }] = await Promise.all([
        client
          .from("message_templates")
          .select("*")
          .eq("business_id", bid)
          .order("updated_at", { ascending: false }),
        client
          .from("business_profiles")
          .select("default_reminder_hours,second_reminder_minutes")
          .eq("id", bid)
          .maybeSingle(),
      ])
      const nextDefaults: ReminderTimingDefaults = {
        firstReminderMinutes:
          typeof profileData?.default_reminder_hours === "number" && Number.isFinite(profileData.default_reminder_hours)
            ? Math.max(1, Math.floor(profileData.default_reminder_hours)) * 60
            : 24 * 60,
        secondReminderMinutes:
          typeof profileData?.second_reminder_minutes === "number" && Number.isFinite(profileData.second_reminder_minutes)
            ? Math.max(0, Math.floor(profileData.second_reminder_minutes))
            : 120,
      }
      if (cancelled) return
      if (error) {
        if (isMissingMessageTemplatesTableError(error.message)) {
          setTemplatesUnavailable(true)
          setLoadError(null)
          setTemplates(toGroupedTemplates([], nextDefaults))
        } else {
          setLoadError(error.message)
        }
      } else {
        setTemplatesUnavailable(false)
        setLoadError(null)
        setTemplates(toGroupedTemplates((data ?? []) as Tables<"message_templates">[], nextDefaults))
      }
      setBusinessId(bid)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [accessReady, accessBusinessId])

  const openEdit = (tpl: GroupedTemplate) => {
    setEditingType(tpl.type)
    setForm(withReadyContent(tpl))
    setSheetOpen(true)
  }

  React.useEffect(() => {
    if (readOnly || !sheetOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSheetOpen(false)
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [sheetOpen, readOnly])

  const submitForm = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form || !businessId || templatesUnavailable || readOnly) return
    const submitFormData = form
    setSaveError(null)
    setShowSaved(false)
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
        if (res.error) {
          setSaveError(res.error.message)
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
        if (res.error) {
          setSaveError(res.error.message)
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
        if (res.error) {
          setSaveError(res.error.message)
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
        if (res.error) {
          setSaveError(res.error.message)
          return
        }
      }
      const [{ data, error }, { data: profileData, error: profileError }] = await Promise.all([
        client
          .from("message_templates")
          .select("*")
          .eq("business_id", businessId)
          .order("updated_at", { ascending: false }),
        client
          .from("business_profiles")
          .select("default_reminder_hours,second_reminder_minutes")
          .eq("id", businessId)
          .maybeSingle(),
      ])
      if (error) {
        setSaveError(error.message)
        return
      }
      if (profileError) {
        setSaveError(profileError.message)
        return
      }
      const nextDefaults: ReminderTimingDefaults = {
        firstReminderMinutes:
          typeof profileData?.default_reminder_hours === "number" &&
          Number.isFinite(profileData.default_reminder_hours)
            ? Math.max(1, Math.floor(profileData.default_reminder_hours)) * 60
            : 24 * 60,
        secondReminderMinutes:
          typeof profileData?.second_reminder_minutes === "number" &&
          Number.isFinite(profileData.second_reminder_minutes)
            ? Math.max(0, Math.floor(profileData.second_reminder_minutes))
            : 120,
      }
      setTemplates(toGroupedTemplates((data ?? []) as Tables<"message_templates">[], nextDefaults))
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
        {saveError ? (
          <div className="mb-3 rounded-md border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {saveError}
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
                    {!readOnly ? (
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
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {!readOnly && sheetOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={editingType ? TEMPLATE_LABELS[editingType] : "Szablon"}
        >
          <div
            className="flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-border/70 px-6 py-5">
              <h3 className="font-heading text-xl">
                {editingType ? TEMPLATE_LABELS[editingType] : "Szablon"}
              </h3>
              <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>
                Zamknij
              </Button>
            </div>
            <form
              onSubmit={submitForm}
              className="premium-scrollbar flex flex-1 flex-col overflow-x-hidden overflow-y-auto"
            >
              <div className="flex-1 space-y-5 px-6 py-6">
                <div className="grid gap-5 lg:grid-cols-2">
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
                      rows={10}
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
                      rows={10}
                      value={form?.emailBody ?? ""}
                      onChange={(e) => setForm((prev) => (prev ? { ...prev, emailBody: e.target.value } : prev))}
                      placeholder="Treść e-maila"
                    />
                  </div>
                </div>
                {form?.type === "reminder_24h" || form?.type === "reminder_before_visit" ? (
                  <div className="space-y-2">
                    <Label>Wyślij ile czasu przed wizytą</Label>
                    <NativeSelect
                      className="w-full sm:max-w-xs"
                      value={String(form?.timingMinutesBefore ?? "")}
                      onChange={(v) => {
                        const parsed = Number(v)
                        if (Number.isNaN(parsed)) return
                        setForm((prev) => (prev ? { ...prev, timingMinutesBefore: Math.max(0, parsed) } : prev))
                      }}
                    >
                      {REMINDER_TIMING_OPTIONS.map((opt) => (
                        <option key={opt.value} value={String(opt.value)}>
                          {opt.label}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                ) : null}
                <div className="text-xs text-muted-foreground">
                  Dostępne zmienne: {"{{imie}}"}, {"{{data}}"}, {"{{godzina}}"}, {"{{usluga}}"}, {"{{osoba}}"}, {"{{link_rezerwacji}}"}, {"{{link_potwierdzenia}}"}, {"{{link_anulowania}}"}, {"{{telefon_firmy}}"}, {"{{adres_firmy}}"}, {"{{nazwa_firmy}}"}
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
          </div>
        </div>
      ) : null}
    </>
  )
}
