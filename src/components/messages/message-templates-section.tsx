"use client"

import * as React from "react"
import {
  Check,
  Mail,
  MessageSquareText,
  Pencil,
  Smartphone,
  Trash2,
} from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { FormActions } from "@/components/shared/form-actions"
import { semanticStatusBadgeClass } from "@/components/shared/status-tone"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import {
  templateChannelOrder,
  templateStatusOrder,
  templateTypeOrder,
} from "@/config/message-templates"
import { buildInitialMessageTemplates } from "@/lib/i18n/template-defaults"
import { useTranslations } from "@/lib/i18n/use-translations"
import { cn } from "@/lib/utils"
import type {
  MessageTemplate,
  MessageTemplateChannel,
  MessageTemplateStatus,
  MessageTemplateType,
} from "@/types/domain"

type FormState = {
  title: string
  type: MessageTemplateType
  channel: MessageTemplateChannel
  body: string
  status: MessageTemplateStatus
}

const emptyForm = (): FormState => ({
  title: "",
  type: "reminder",
  channel: "sms",
  body: "",
  status: "draft",
})

function formFromTemplate(tpl: MessageTemplate): FormState {
  return {
    title: tpl.title,
    type: tpl.type,
    channel: tpl.channel,
    body: tpl.body,
    status: tpl.status,
  }
}

function statusBadgeClass(status: MessageTemplateStatus) {
  return semanticStatusBadgeClass(status === "active" ? "success" : "neutral")
}

export type MessageTemplatesSectionProps = {
  onRegisterPrimaryAction?: (openCreate: () => void) => void
}

export function MessageTemplatesSection({
  onRegisterPrimaryAction,
}: MessageTemplatesSectionProps) {
  const { t, language } = useTranslations()
  const [templates, setTemplates] = React.useState<MessageTemplate[]>(() =>
    buildInitialMessageTemplates(language)
  )
  const [userPreviewId, setUserPreviewId] = React.useState<string | null>(() => {
    const initial = buildInitialMessageTemplates(language)
    return initial[0]?.id ?? null
  })

  const defaultTemplatesPL = React.useMemo(
    () => buildInitialMessageTemplates("pl"),
    []
  )
  const defaultTemplatesEN = React.useMemo(
    () => buildInitialMessageTemplates("en"),
    []
  )

  const defaultByIdPL = React.useMemo(() => {
    return Object.fromEntries(defaultTemplatesPL.map((tpl) => [tpl.id, tpl]))
  }, [defaultTemplatesPL])
  const defaultByIdEN = React.useMemo(() => {
    return Object.fromEntries(defaultTemplatesEN.map((tpl) => [tpl.id, tpl]))
  }, [defaultTemplatesEN])

  const templatesAreEqual = React.useCallback(
    (a: MessageTemplate, b: MessageTemplate) =>
      a.id === b.id &&
      a.title === b.title &&
      a.type === b.type &&
      a.channel === b.channel &&
      a.status === b.status &&
      a.body === b.body,
    []
  )

  const displayTemplates = React.useMemo(() => {
    return templates.map((tpl) => {
      const pl = defaultByIdPL[tpl.id]
      const en = defaultByIdEN[tpl.id]
      if (pl && templatesAreEqual(tpl, pl)) {
        return language === "pl" ? pl : en ?? pl
      }
      if (en && templatesAreEqual(tpl, en)) {
        return language === "en" ? en : pl ?? en
      }
      return tpl
    })
  }, [templates, language, defaultByIdPL, defaultByIdEN, templatesAreEqual])

  const previewId = React.useMemo(() => {
    if (displayTemplates.length === 0) return null
    if (
      userPreviewId &&
      displayTemplates.some((t) => t.id === userPreviewId)
    ) {
      return userPreviewId
    }
    return displayTemplates[0].id
  }, [displayTemplates, userPreviewId])
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [form, setForm] = React.useState<FormState>(emptyForm)
  const [showSaved, setShowSaved] = React.useState(false)

  const previewTemplate = React.useMemo(
    () =>
      previewId
        ? displayTemplates.find((t) => t.id === previewId) ?? null
        : null,
    [displayTemplates, previewId]
  )

  const openCreate = React.useCallback(() => {
    setEditingId(null)
    setForm(emptyForm())
    setSheetOpen(true)
  }, [])

  React.useEffect(() => {
    onRegisterPrimaryAction?.(openCreate)
  }, [onRegisterPrimaryAction, openCreate])

  const openEdit = (tpl: MessageTemplate) => {
    setEditingId(tpl.id)
    setForm(formFromTemplate(tpl))
    setSheetOpen(true)
  }

  const submitForm = (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      title: form.title.trim(),
      type: form.type,
      channel: form.channel,
      body: form.body.trim(),
      status: form.status,
    }
    if (editingId) {
      setTemplates((prev) =>
        prev.map((x) =>
          x.id === editingId ? { ...x, ...payload } : x
        )
      )
    } else {
      const next: MessageTemplate = {
        id: crypto.randomUUID(),
        ...payload,
      }
      setTemplates((prev) => [next, ...prev])
      setUserPreviewId(next.id)
    }
    setSheetOpen(false)
    setShowSaved(true)
  }

  const removeTemplate = (id: string) => {
    if (!window.confirm(t("messages.deleteConfirm"))) {
      return
    }
    setTemplates((prev) => prev.filter((t) => t.id !== id))
  }

  const isEmpty = templates.length === 0

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

        {isEmpty ? (
          <div className="mt-2 min-w-0">
            <EmptyState
              icon={MessageSquareText}
              title={t("messages.emptyTitle")}
              description={t("messages.emptyDescription")}
              actionLabel={t("common.addTemplate")}
              onAction={openCreate}
            />
          </div>
        ) : (
          <div className="mt-2 grid min-w-0 gap-4 lg:grid-cols-12 lg:items-start">
            <ul
              className="flex min-w-0 flex-col gap-3 lg:col-span-5"
              data-tour="messages-list"
            >
              {displayTemplates.map((row) => {
                const active = previewId === row.id
                const snippet =
                  row.body.length > 140
                    ? `${row.body.slice(0, 140).trim()}...`
                    : row.body
                return (
                  <li key={row.id}>
                    <div
                      className={cn(
                        "rounded-2xl border border-border bg-card p-0 text-sm shadow-sm shadow-slate-900/5",
                        active
                          ? "border-primary/25 bg-[color:var(--nav-active-bg)]"
                          : ""
                      )}
                    >
                      <div className="flex min-h-[5.5rem] flex-col gap-2 p-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                        <div className="min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => setUserPreviewId(row.id)}
                            className="w-full text-left"
                          >
                            <p className="font-medium text-foreground">
                              {row.title}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {row.channel === "sms" ? (
                                <span className="inline-flex items-center gap-0.5">
                                  <Smartphone className="size-3" aria-hidden />
                                  {t("messages.sms")}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5">
                                  <Mail className="size-3" aria-hidden />
                                  {t("messages.email")}
                                </span>
                              )}{" "}
                              -{" "}
                              {t(`labels.templateType.${row.type}` as "labels.templateType.reminder")}
                            </p>
                            <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
                              {snippet}
                            </p>
                          </button>
                          <div className="mt-2">
                            <span className={cn("text-xs font-medium", statusBadgeClass(row.status))}>
                              {t(`labels.templateStatus.${row.status}` as "labels.templateStatus.active")}
                            </span>
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-2 sm:flex-col sm:items-stretch sm:pl-0">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-9 rounded-xl"
                            onClick={() => openEdit(row)}
                          >
                            <Pencil className="size-3" />
                            {t("common.edit")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-9 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => removeTemplate(row.id)}
                          >
                            <Trash2 className="size-3" />
                            {t("common.delete")}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>

            <div className="min-w-0 lg:col-span-7">
              {previewTemplate ? (
                <Card className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5 lg:sticky lg:top-20">
                  <CardHeader className="space-y-1 border-b border-border py-4">
                    <p className="text-xs text-muted-foreground">
                      {t("messages.preview")}
                    </p>
                    <CardTitle className="text-sm font-semibold leading-snug">
                      {previewTemplate.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="min-w-0 pt-4">
                    {previewTemplate.channel === "sms" ? (
                      <div className="max-w-md rounded-2xl border border-border bg-muted/60 p-4 text-sm shadow-sm shadow-slate-900/5">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold text-muted-foreground">
                            {t("messages.sms")}
                          </p>
                          <span className="rounded-full bg-card px-3 py-1 text-xs font-semibold text-primary">
                            {t("messages.preview")}
                          </span>
                        </div>
                        <div className="mt-3 rounded-2xl border border-border bg-card px-4 py-3">
                          <p className="whitespace-pre-wrap break-words leading-relaxed text-foreground">
                            {previewTemplate.body}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5">
                        <div className="border-b border-border bg-muted/60 px-4 py-2 text-xs font-semibold text-muted-foreground">
                          {t("messages.email")}
                        </div>
                        <div className="border-b border-border px-4 py-2 text-sm">
                          <span className="text-muted-foreground">
                            {t("messages.subject")}:{" "}
                          </span>
                          <span className="font-semibold text-foreground">
                            {previewTemplate.title}
                          </span>
                        </div>
                        <div className="px-4 py-4">
                          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
                            {previewTemplate.body}
                          </p>
                        </div>
                      </div>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t("messages.previewVariablesHint")}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => {
                          openEdit(previewTemplate)
                        }}
                      >
                        <Pencil className="size-3" />
                        {t("messages.previewEditShortcut")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </div>
        )}
      </section>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col border-border/80 bg-card p-0 sm:max-w-lg"
          showCloseButton
        >
          <SheetHeader className="space-y-1 border-b border-border/70 px-6 py-6 text-left">
            <SheetTitle className="font-heading text-xl">
              {editingId ? t("messages.sheetEditTitle") : t("messages.sheetCreateTitle")}
            </SheetTitle>
            <SheetDescription className="text-sm text-muted-foreground">
              {editingId ? t("messages.sheetEditHint") : t("messages.sheetCreateHint")}
            </SheetDescription>
          </SheetHeader>
          <form
            onSubmit={submitForm}
            className="premium-scrollbar flex flex-1 flex-col overflow-y-auto"
          >
            <div className="flex-1 space-y-5 px-6 py-6">
              <div className="space-y-2">
                <Label htmlFor="tpl-title">{t("messages.fieldTitle")}</Label>
                <Input
                  id="tpl-title"
                  required
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  placeholder={t("messages.fieldTitlePlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tpl-type">{t("messages.fieldType")}</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, type: v as MessageTemplateType }))
                  }
                >
                  <SelectTrigger id="tpl-type" className="h-10 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {templateTypeOrder.map((tplType) => (
                      <SelectItem key={tplType} value={tplType}>
                        {t(`labels.templateType.${tplType}` as "labels.templateType.reminder")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tpl-channel">{t("messages.fieldChannel")}</Label>
                <Select
                  value={form.channel}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      channel: v as MessageTemplateChannel,
                    }))
                  }
                >
                  <SelectTrigger id="tpl-channel" className="h-10 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {templateChannelOrder.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c === "sms"
                          ? t("messages.sms")
                          : t("messages.email")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tpl-body">{t("messages.fieldBody")}</Label>
                <Textarea
                  id="tpl-body"
                  required
                  rows={10}
                  value={form.body}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, body: e.target.value }))
                  }
                  placeholder={t("messages.bodyPlaceholder")}
                  className="resize-none font-mono text-[13px] leading-relaxed"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tpl-status">{t("messages.fieldStatus")}</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      status: v as MessageTemplateStatus,
                    }))
                  }
                >
                  <SelectTrigger id="tpl-status" className="h-10 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {templateStatusOrder.map((s) => (
                      <SelectItem key={s} value={s}>
                        {t(`labels.templateStatus.${s}` as "labels.templateStatus.active")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <SheetFooter className="mt-auto border-t border-border/70 bg-muted/20 px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <FormActions
                cancelLabel={t("messages.cancel")}
                submitLabel={editingId ? t("common.saveChanges") : t("messages.saveDraft")}
                onCancel={() => setSheetOpen(false)}
              />
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  )
}
