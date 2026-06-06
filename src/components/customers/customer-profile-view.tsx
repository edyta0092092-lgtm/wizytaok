"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, Download, FileText, Mail, Pencil, Phone } from "lucide-react"

import { CustomerStatsGrid } from "@/components/customers/customer-stats-grid"
import { CustomerVisitHistory } from "@/components/customers/customer-visit-history"
import { InternationalPhoneFieldGroup } from "@/components/forms/international-phone-field-group"
import { FormActions } from "@/components/shared/form-actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  CLIENT_ATTACHMENT_ACCEPT,
  formatClientAttachmentSize,
  isEmailFormatValid,
  readClientAttachmentFiles,
} from "@/lib/clients/client-attachments"
import {
  buildPriorIdentity,
  persistClientAttachments,
  persistClientUpdates,
  persistClientsCatalog,
  type ClientsLoadMode,
} from "@/lib/clients/clients-store"
import { formatCustomerDate } from "@/lib/customers/format-customer-datetime"
import { joinCustomerName, splitCustomerName } from "@/lib/customers/customer-name"
import type { CustomerCrmRow } from "@/lib/customers/customer-types"
import { useTranslations } from "@/lib/i18n/use-translations"
import {
  buildStoredInternationalPhone,
  splitStoredPhoneIntoParts,
  validateNationalPhoneLength,
} from "@/lib/validation/international-phone"
import type { Client, ClientAttachment } from "@/types/domain"

type WorkspaceMeta = {
  mode: ClientsLoadMode
  businessProfileId: string | null
  businessSlug: string | null
}

type DetailForm = {
  firstName: string
  lastName: string
  phoneDialCode: string
  phoneNational: string
  email: string
  notes: string
}

function toDetailForm(customer: CustomerCrmRow): DetailForm {
  const split = splitCustomerName(customer.fullName)
  const phoneParts = splitStoredPhoneIntoParts(customer.phone)
  return {
    firstName: split.firstName,
    lastName: split.lastName,
    phoneDialCode: phoneParts.dialCode,
    phoneNational: phoneParts.nationalDigits,
    email: customer.email,
    notes: customer.notes?.trim() ? customer.notes : "",
  }
}

export function CustomerProfileView({
  customer,
  workspace,
  clients,
  onCustomerUpdated,
}: {
  customer: CustomerCrmRow
  workspace: WorkspaceMeta
  clients: Client[]
  onCustomerUpdated: (customer: CustomerCrmRow) => void
}) {
  const { t, language } = useTranslations()
  const [editing, setEditing] = React.useState(false)
  const [form, setForm] = React.useState<DetailForm>(() => toDetailForm(customer))
  const [attachments, setAttachments] = React.useState<ClientAttachment[]>(customer.attachments)
  const [fieldError, setFieldError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [savedBanner, setSavedBanner] = React.useState(false)

  React.useEffect(() => {
    setEditing(false)
    setForm(toDetailForm(customer))
    setAttachments(customer.attachments)
    setFieldError(null)
  }, [customer])

  React.useEffect(() => {
    if (!savedBanner) return
    const tid = window.setTimeout(() => setSavedBanner(false), 4500)
    return () => window.clearTimeout(tid)
  }, [savedBanner])

  const startEdit = () => {
    setForm(toDetailForm(customer))
    setAttachments(customer.attachments)
    setFieldError(null)
    setEditing(true)
  }

  const cancelEdit = () => {
    setForm(toDetailForm(customer))
    setAttachments(customer.attachments)
    setFieldError(null)
    setEditing(false)
  }

  const handleAttachmentUpload = async (files: FileList | null) => {
    const next = await readClientAttachmentFiles(files, (key) => {
      setFieldError(t(`clients.${key}`))
    })
    if (next.length === 0) return
    setFieldError(null)
    setAttachments((prev) => [...prev, ...next])
  }

  const removeAttachment = (attachmentId: string) => {
    setAttachments((prev) => prev.filter((attachment) => attachment.id !== attachmentId))
  }

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    const fullName = joinCustomerName(form.firstName, form.lastName)
    const phone = buildStoredInternationalPhone(form.phoneDialCode, form.phoneNational).trim()
    const email = form.email.trim()

    if (!fullName) {
      setFieldError(t("clients.validationFullName"))
      return
    }
    if (!phone) {
      setFieldError(t("clients.validationPhoneRequired"))
      return
    }
    if (!validateNationalPhoneLength(form.phoneDialCode, form.phoneNational).ok) {
      setFieldError(t("clients.validationPhoneInvalid"))
      return
    }
    if (!isEmailFormatValid(email)) {
      setFieldError(t("clients.validationEmail"))
      return
    }

    setFieldError(null)
    setSaving(true)
    try {
      const sourceClient = clients.find((c) => c.id === customer.id)
      const prior = buildPriorIdentity(
        sourceClient ?? {
          fullName: customer.fullName,
          phone: customer.phone,
          email: customer.email,
        },
      )
      const res = await persistClientUpdates({
        mode: workspace.mode,
        clientId: customer.id,
        prior,
        nextFields: {
          fullName,
          phone,
          email,
          notes: form.notes,
        },
        businessProfileId: workspace.businessProfileId,
        businessSlugNormalized: workspace.businessSlug,
        currentList: clients,
      })
      if (!res.ok) {
        const details = res.errorMessage?.trim()
        setFieldError(
          details ? `${t("clients.saveFailed")} ${details}` : t("clients.saveFailed"),
        )
        return
      }

      const updatedClients = res.clients.map((client) =>
        client.id === customer.id ||
        (client.fullName === fullName && client.phone === phone && client.email === email)
          ? { ...client, attachments }
          : client,
      )
      const updatedClientId =
        updatedClients.find(
          (client) =>
            client.id === customer.id ||
            (client.fullName === fullName && client.phone === phone && client.email === email),
        )?.id ?? customer.id
      persistClientAttachments(updatedClientId, attachments)
      persistClientsCatalog(updatedClients)

      const { firstName, lastName } = splitCustomerName(fullName)
      onCustomerUpdated({
        ...customer,
        id: updatedClientId,
        fullName,
        firstName,
        lastName,
        phone,
        email,
        notes: form.notes.trim() || undefined,
        attachments,
      })
      setEditing(false)
      setSavedBanner(true)
    } catch (error) {
      const details = error instanceof Error ? error.message : null
      setFieldError(details ? `${t("clients.saveFailed")} ${details}` : t("clients.saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" className="h-9 w-fit rounded-xl" asChild>
          <Link href="/klienci">
            <ArrowLeft className="mr-1.5 size-4" aria-hidden />
            {t("customers.profile.backToList")}
          </Link>
        </Button>
        {!editing ? (
          <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl" onClick={startEdit}>
            <Pencil className="mr-1.5 size-4" aria-hidden />
            {t("clients.editClient")}
          </Button>
        ) : null}
      </div>

      {savedBanner ? (
        <p className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-2 text-sm text-foreground">
          {t("clients.updatedBanner")}
        </p>
      ) : null}

      <Card className="rounded-2xl border border-border shadow-sm shadow-slate-900/5">
        <CardHeader className="space-y-3">
          <div>
            <CardTitle className="text-xl">{editing ? t("clients.editClient") : customer.fullName}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{t("customers.profile.contactTitle")}</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {editing ? (
            <form id="customer-profile-edit-form" className="space-y-6" onSubmit={(e) => void submitEdit(e)}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="customer-firstName">{t("team.firstName")}</Label>
                  <Input
                    id="customer-firstName"
                    autoComplete="given-name"
                    required
                    className="h-11 rounded-xl"
                    value={form.firstName}
                    onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer-lastName">{t("team.lastName")}</Label>
                  <Input
                    id="customer-lastName"
                    autoComplete="family-name"
                    className="h-11 rounded-xl"
                    value={form.lastName}
                    onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))}
                  />
                </div>
              </div>

              <InternationalPhoneFieldGroup
                label={t("customers.fieldPhone")}
                dialCode={form.phoneDialCode}
                nationalDigits={form.phoneNational}
                onDialCodeChange={(v) => setForm((prev) => ({ ...prev, phoneDialCode: v }))}
                onNationalChange={(digits) => setForm((prev) => ({ ...prev, phoneNational: digits }))}
                dialSelectId="customer-phone-dial"
                nationalInputId="customer-phone-national"
              />

              <div className="space-y-2">
                <Label htmlFor="customer-email">{t("customers.fieldEmail")}</Label>
                <Input
                  id="customer-email"
                  type="email"
                  autoComplete="email"
                  className="h-11 rounded-xl"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer-notes">{t("clients.sectionNotesHead")}</Label>
                <Textarea
                  id="customer-notes"
                  rows={4}
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder={t("clients.notesPlaceholderUi")}
                  className="min-h-[120px] resize-none rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer-attachments">{t("clients.sectionAttachmentsHead")}</Label>
                <Input
                  id="customer-attachments"
                  type="file"
                  accept={CLIENT_ATTACHMENT_ACCEPT}
                  multiple
                  className="h-auto cursor-pointer py-2"
                  onChange={(e) => {
                    void handleAttachmentUpload(e.target.files)
                    e.currentTarget.value = ""
                  }}
                />
                <p className="text-xs text-muted-foreground">{t("clients.attachmentHelp")}</p>
                {attachments.length > 0 ? (
                  <ul className="space-y-2">
                    {attachments.map((attachment) => (
                      <li
                        key={attachment.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/15 px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{attachment.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatClientAttachmentSize(attachment.size)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 shrink-0 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => removeAttachment(attachment.id)}
                        >
                          {t("common.delete")}
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              {fieldError ? (
                <p className="text-sm text-destructive" role="alert">
                  {fieldError}
                </p>
              ) : null}

              <FormActions
                cancelLabel={t("messages.cancel")}
                submitLabel={t("common.saveChanges")}
                onCancel={cancelEdit}
                isSubmitting={saving}
                submitForm="customer-profile-edit-form"
                submitType="submit"
              />
            </form>
          ) : (
            <>
              <dl className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-start gap-2 text-sm">
                  <Phone className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("customers.fieldPhone")}</dt>
                    <dd className="font-medium">{customer.phone || "—"}</dd>
                  </div>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("customers.fieldEmail")}</dt>
                    <dd className="font-medium break-all">{customer.email || "—"}</dd>
                  </div>
                </div>
              </dl>

              {customer.nextVisitAt ? (
                <p className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
                  <span className="font-medium text-foreground">{t("customers.profile.nextVisit")}: </span>
                  <span className="text-muted-foreground">
                    {formatCustomerDate(customer.nextVisitAt, language)}
                  </span>
                </p>
              ) : null}

              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("clients.sectionNotesHead")}
                </h3>
                <p className="rounded-xl border border-border/80 bg-muted/15 px-4 py-3 text-sm leading-relaxed text-foreground">
                  {customer.notes?.trim() ? customer.notes : t("clients.noNotesText")}
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("clients.sectionAttachmentsHead")}
                </h3>
                {customer.attachments.length > 0 ? (
                  <ul className="space-y-2">
                    {customer.attachments.map((attachment) => (
                      <li
                        key={attachment.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-card px-4 py-3 text-sm"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{attachment.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatClientAttachmentSize(attachment.size)}
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 shrink-0 rounded-lg"
                          asChild
                        >
                          <a href={attachment.dataUrl} download={attachment.name}>
                            <Download className="size-3.5" aria-hidden />
                            {t("clients.attachmentDownload")}
                          </a>
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
                    {t("clients.noAttachmentsText")}
                  </p>
                )}
              </section>
            </>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">{t("customers.profile.statsTitle")}</h2>
        <CustomerStatsGrid customer={customer} />
      </section>

      <section className="space-y-3">
        <CustomerVisitHistory visits={customer.visits} />
      </section>
    </div>
  )
}
