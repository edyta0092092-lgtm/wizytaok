"use client"

import * as React from "react"
import { Check, Pencil, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useBusinessAccess } from "@/lib/auth/business-access-context"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import type { Tables } from "@/types/database"

type TriggerType = "schedule_before" | "schedule_after" | "event" | "manual"
type EventKey = "created" | "confirmed" | "cancelled" | "no_show" | "completed"
type OffsetUnit = "minutes" | "hours" | "days"

type CustomForm = {
  id: string | null
  name: string
  smsEnabled: boolean
  smsContent: string
  emailEnabled: boolean
  emailSubject: string
  emailContent: string
  triggerType: TriggerType
  offsetValue: number
  offsetUnit: OffsetUnit
  eventKey: EventKey
  status: "active" | "draft"
}

const EVENT_LABELS: Record<EventKey, string> = {
  created: "Utworzenie rezerwacji",
  confirmed: "Potwierdzenie wizyty",
  cancelled: "Anulowanie wizyty",
  no_show: "Nieobecność klienta",
  completed: "Zakończenie wizyty",
}

const TRIGGER_LABELS: Record<TriggerType, string> = {
  schedule_before: "Zaplanowane przed wizytą",
  schedule_after: "Zaplanowane po wizycie",
  event: "Na zdarzenie / zmianę statusu",
  manual: "Ręczne (wyślij teraz)",
}

const UNIT_MINUTES: Record<OffsetUnit, number> = {
  minutes: 1,
  hours: 60,
  days: 60 * 24,
}

function emptyForm(): CustomForm {
  return {
    id: null,
    name: "",
    smsEnabled: false,
    smsContent: "",
    emailEnabled: true,
    emailSubject: "",
    emailContent: "",
    triggerType: "schedule_before",
    offsetValue: 1,
    offsetUnit: "days",
    eventKey: "completed",
    status: "active",
  }
}

function splitOffset(minutes: number | null): { value: number; unit: OffsetUnit } {
  const m = typeof minutes === "number" && Number.isFinite(minutes) ? Math.max(0, Math.floor(minutes)) : 0
  if (m === 0) return { value: 0, unit: "minutes" }
  if (m % UNIT_MINUTES.days === 0) return { value: m / UNIT_MINUTES.days, unit: "days" }
  if (m % UNIT_MINUTES.hours === 0) return { value: m / UNIT_MINUTES.hours, unit: "hours" }
  return { value: m, unit: "minutes" }
}

function rowToForm(row: Tables<"custom_templates">): CustomForm {
  const off = splitOffset(row.offset_minutes)
  const trigger = (row.trigger_type as TriggerType) ?? "manual"
  return {
    id: row.id,
    name: row.name ?? "",
    smsEnabled: Boolean(row.sms_enabled),
    smsContent: row.sms_content ?? "",
    emailEnabled: Boolean(row.email_enabled),
    emailSubject: row.email_subject ?? "",
    emailContent: row.email_content ?? "",
    triggerType: trigger,
    offsetValue: off.value || 1,
    offsetUnit: off.unit,
    eventKey: (row.event_key as EventKey) ?? "completed",
    status: row.status === "active" ? "active" : "draft",
  }
}

function describeTrigger(row: Tables<"custom_templates">): string {
  const trigger = (row.trigger_type as TriggerType) ?? "manual"
  if (trigger === "event") {
    const key = (row.event_key as EventKey) ?? "completed"
    return `Zdarzenie: ${EVENT_LABELS[key] ?? key}`
  }
  if (trigger === "manual") return TRIGGER_LABELS.manual
  const off = splitOffset(row.offset_minutes)
  const unitLabel = off.unit === "days" ? "dni" : off.unit === "hours" ? "godz." : "min"
  const direction = trigger === "schedule_before" ? "przed wizytą" : "po wizycie"
  return `${off.value} ${unitLabel} ${direction}`
}

export type CustomTemplatesSectionProps = {
  readOnly?: boolean
}

export function CustomTemplatesSection({ readOnly = false }: CustomTemplatesSectionProps) {
  const { ready: accessReady, businessId: accessBusinessId } = useBusinessAccess()
  const [rows, setRows] = React.useState<Tables<"custom_templates">[]>([])
  const [businessId, setBusinessId] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [form, setForm] = React.useState<CustomForm | null>(null)
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const [showSaved, setShowSaved] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const dialogRef = React.useRef<HTMLDivElement | null>(null)

  const reload = React.useCallback(async (bid: string) => {
    const client = getBrowserClient()
    if (!client || !isSupabaseConfigured()) return
    const { data, error } = await client
      .from("custom_templates")
      .select("*")
      .eq("business_id", bid)
      .order("updated_at", { ascending: false })
    if (error) {
      setLoadError(error.message)
      return
    }
    setLoadError(null)
    setRows((data ?? []) as Tables<"custom_templates">[])
  }, [])

  React.useEffect(() => {
    if (!accessReady) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      const bid = accessBusinessId
      if (!bid || !isSupabaseConfigured() || !getBrowserClient()) {
        if (!cancelled) {
          setRows([])
          setBusinessId(null)
          setLoading(false)
        }
        return
      }
      await reload(bid)
      if (cancelled) return
      setBusinessId(bid)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [accessReady, accessBusinessId, reload])

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

  const openCreate = () => {
    if (readOnly) return
    setForm(emptyForm())
    setSaveError(null)
    setSheetOpen(true)
  }
  const openEdit = (row: Tables<"custom_templates">) => {
    if (readOnly) return
    setForm(rowToForm(row))
    setSaveError(null)
    setSheetOpen(true)
  }

  const handleDelete = (row: Tables<"custom_templates">) => {
    if (readOnly || !businessId) return
    if (!window.confirm(`Usunąć szablon „${row.name || "bez nazwy"}"?`)) return
    void (async () => {
      const client = getBrowserClient()
      if (!client) return
      const res = await client.from("custom_templates").delete().eq("id", row.id)
      if (res.error) {
        setLoadError(res.error.message)
        return
      }
      await reload(businessId)
    })()
  }

  const submitForm = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form || !businessId || readOnly || saving) return
    const f = form
    const name = f.name.trim()
    if (!name) {
      setSaveError("Podaj nazwę szablonu.")
      return
    }
    if (!f.smsEnabled && !f.emailEnabled) {
      setSaveError("Włącz przynajmniej jeden kanał (SMS lub e-mail).")
      return
    }
    if (f.smsEnabled && !f.smsContent.trim()) {
      setSaveError("Uzupełnij treść SMS.")
      return
    }
    if (f.emailEnabled && !f.emailContent.trim()) {
      setSaveError("Uzupełnij treść e-maila.")
      return
    }
    const isSchedule = f.triggerType === "schedule_before" || f.triggerType === "schedule_after"
    if (isSchedule && (!Number.isFinite(f.offsetValue) || f.offsetValue <= 0)) {
      setSaveError("Podaj poprawny czas wysyłki (większy od zera).")
      return
    }
    const offsetMinutes = isSchedule ? Math.round(f.offsetValue * UNIT_MINUTES[f.offsetUnit]) : null
    const payload = {
      business_id: businessId,
      name,
      sms_enabled: f.smsEnabled,
      sms_content: f.smsContent,
      email_enabled: f.emailEnabled,
      email_subject: f.emailSubject,
      email_content: f.emailContent,
      trigger_type: f.triggerType,
      offset_minutes: offsetMinutes,
      event_key: f.triggerType === "event" ? f.eventKey : null,
      status: f.status,
    }
    setSaveError(null)
    setShowSaved(false)
    setSaving(true)
    void (async () => {
      const client = getBrowserClient()
      if (!client || !isSupabaseConfigured()) {
        setSaving(false)
        return
      }
      const res = f.id
        ? await client.from("custom_templates").update(payload as never).eq("id", f.id)
        : await client.from("custom_templates").insert(payload as never)
      if (res.error) {
        setSaveError(res.error.message)
        setSaving(false)
        return
      }
      await reload(businessId)
      setSaving(false)
      setShowSaved(true)
      setSheetOpen(false)
    })()
  }

  return (
    <>
      <section aria-labelledby="custom-templates-heading" className="min-w-0">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="custom-templates-heading" className="text-base font-semibold text-foreground">
            Własne szablony
          </h2>
          {!readOnly ? (
            <Button type="button" size="sm" className="h-8 gap-1 text-xs" onClick={openCreate}>
              <Plus className="size-3.5" />
              Nowy szablon
            </Button>
          ) : null}
        </div>

        {showSaved ? (
          <div
            role="status"
            className="mb-3 flex items-center gap-2 rounded-md border border-success/25 bg-success/10 px-3 py-2 text-sm text-[#14532D]"
          >
            <Check className="size-4 shrink-0 text-success" aria-hidden />
            Zapisano szablon.
          </div>
        ) : null}
        {loadError ? (
          <div className="mb-3 rounded-md border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {loadError}
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">Wczytywanie…</p>
        ) : rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
            Nie masz jeszcze własnych szablonów. Utwórz dowolną wiadomość (SMS/e-mail) i wybierz, kiedy ma się wysłać.
          </p>
        ) : (
          <div className="mt-2 grid min-w-0 gap-2 md:grid-cols-2">
            {rows.map((row) => (
              <Card key={row.id} className="rounded-xl border border-border bg-card shadow-sm shadow-slate-900/5">
                <CardHeader className="space-y-1 px-4 py-3">
                  <CardTitle className="text-[13px] leading-snug">{row.name || "Bez nazwy"}</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 pt-0">
                  <p className="text-[11px] text-muted-foreground">
                    {describeTrigger(row)} · {row.status === "active" ? "włączony" : "wyłączony"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    SMS: {row.sms_enabled ? "on" : "off"} · E-mail: {row.email_enabled ? "on" : "off"}
                  </p>
                  {!readOnly ? (
                    <div className="mt-2 flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(row)}
                        className="h-8 rounded-lg px-2.5 text-xs"
                      >
                        <Pencil className="size-3" />
                        Edytuj
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(row)}
                        className="h-8 rounded-lg px-2.5 text-xs text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-3" />
                        Usuń
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {!readOnly && sheetOpen && form ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Własny szablon"
        >
          <div
            ref={dialogRef}
            className="flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-border/70 px-6 py-5">
              <h3 className="font-heading text-xl">{form.id ? "Edytuj szablon" : "Nowy szablon"}</h3>
              <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>
                Zamknij
              </Button>
            </div>
            <form
              onSubmit={submitForm}
              className="premium-scrollbar flex flex-1 flex-col overflow-x-hidden overflow-y-auto"
            >
              <div className="flex-1 space-y-5 px-6 py-6">
                {saveError ? (
                  <div className="rounded-md border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {saveError}
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label className="font-medium">Nazwa szablonu</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
                    placeholder="np. Podziękowanie po wizycie"
                  />
                </div>

                <div className="space-y-3 rounded-xl border border-border p-3">
                  <Label className="font-medium">Kiedy wysłać?</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(Object.keys(TRIGGER_LABELS) as TriggerType[]).map((tt) => (
                      <label key={tt} className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="trigger"
                          checked={form.triggerType === tt}
                          onChange={() => setForm((prev) => (prev ? { ...prev, triggerType: tt } : prev))}
                        />
                        {TRIGGER_LABELS[tt]}
                      </label>
                    ))}
                  </div>

                  {form.triggerType === "schedule_before" || form.triggerType === "schedule_after" ? (
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Ile</Label>
                        <Input
                          type="number"
                          min={1}
                          value={String(form.offsetValue)}
                          onChange={(e) =>
                            setForm((prev) =>
                              prev ? { ...prev, offsetValue: Math.max(0, Number(e.target.value) || 0) } : prev,
                            )
                          }
                          className="w-24"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Jednostka</Label>
                        <select
                          className="h-10 w-36 rounded-xl border border-input bg-card px-3 text-sm"
                          value={form.offsetUnit}
                          onChange={(e) =>
                            setForm((prev) =>
                              prev ? { ...prev, offsetUnit: e.target.value as OffsetUnit } : prev,
                            )
                          }
                        >
                          <option value="minutes">minut</option>
                          <option value="hours">godzin</option>
                          <option value="days">dni</option>
                        </select>
                      </div>
                      <p className="pb-2 text-xs text-muted-foreground">
                        {form.triggerType === "schedule_before" ? "przed wizytą" : "po wizycie"}
                      </p>
                    </div>
                  ) : null}

                  {form.triggerType === "event" ? (
                    <div className="space-y-1">
                      <Label className="text-xs">Zdarzenie</Label>
                      <select
                        className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm sm:w-72"
                        value={form.eventKey}
                        onChange={(e) =>
                          setForm((prev) => (prev ? { ...prev, eventKey: e.target.value as EventKey } : prev))
                        }
                      >
                        {(Object.keys(EVENT_LABELS) as EventKey[]).map((k) => (
                          <option key={k} value={k}>
                            {EVENT_LABELS[k]}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}

                  {form.triggerType === "manual" ? (
                    <p className="text-xs text-muted-foreground">
                      Wysyłka ręczna z poziomu wizyty (akcja „Wyślij wiadomość”).
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  <div className="space-y-2 rounded-xl border border-border p-3">
                    <Label className="font-medium">Kanał SMS</Label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.smsEnabled}
                        onChange={(e) => setForm((prev) => (prev ? { ...prev, smsEnabled: e.target.checked } : prev))}
                      />
                      Aktywny
                    </label>
                    <Textarea
                      rows={10}
                      value={form.smsContent}
                      onChange={(e) => setForm((prev) => (prev ? { ...prev, smsContent: e.target.value } : prev))}
                      placeholder="Treść SMS"
                    />
                  </div>
                  <div className="space-y-2 rounded-xl border border-border p-3">
                    <Label className="font-medium">Kanał E-mail</Label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.emailEnabled}
                        onChange={(e) => setForm((prev) => (prev ? { ...prev, emailEnabled: e.target.checked } : prev))}
                      />
                      Aktywny
                    </label>
                    <Input
                      value={form.emailSubject}
                      onChange={(e) => setForm((prev) => (prev ? { ...prev, emailSubject: e.target.value } : prev))}
                      placeholder="Temat e-maila"
                    />
                    <Textarea
                      rows={10}
                      value={form.emailContent}
                      onChange={(e) => setForm((prev) => (prev ? { ...prev, emailContent: e.target.value } : prev))}
                      placeholder="Treść e-maila"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.status === "active"}
                    onChange={(e) =>
                      setForm((prev) => (prev ? { ...prev, status: e.target.checked ? "active" : "draft" } : prev))
                    }
                  />
                  Szablon włączony (wysyłka aktywna)
                </label>

                <div className="text-xs text-muted-foreground">
                  Dostępne zmienne: {"{{imie}}"}, {"{{data}}"}, {"{{godzina}}"}, {"{{usluga}}"}, {"{{osoba}}"}, {"{{link_rezerwacji}}"}, {"{{link_potwierdzenia}}"}, {"{{link_anulowania}}"}, {"{{telefon_firmy}}"}, {"{{adres_firmy}}"}, {"{{nazwa_firmy}}"}
                </div>
              </div>
              <div className="mt-auto flex items-center justify-end gap-2 border-t border-border/70 bg-muted/20 px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>
                  Anuluj
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Zapisywanie…" : "Zapisz szablon"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
