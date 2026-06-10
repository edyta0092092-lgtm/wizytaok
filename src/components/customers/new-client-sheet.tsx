"use client"

import * as React from "react"

import { FormActions } from "@/components/shared/form-actions"
import { InternationalPhoneFieldGroup } from "@/components/forms/international-phone-field-group"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { useTranslations } from "@/lib/i18n/use-translations"

export type NewClientFormState = {
  firstName: string
  lastName: string
  phoneDialCode: string
  phoneNational: string
  email: string
  notes: string
}

export type NewClientSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  form: NewClientFormState
  setForm: React.Dispatch<React.SetStateAction<NewClientFormState>>
  fieldError: string | null
  isSaving: boolean
  onSubmit: (e: React.FormEvent) => void
}

export function NewClientSheet({
  open,
  onOpenChange,
  form,
  setForm,
  fieldError,
  isSaving,
  onSubmit,
}: NewClientSheetProps) {
  const { t } = useTranslations()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-lg" showCloseButton>
        <SheetHeader className="border-b border-border/70 px-6 py-5 text-left">
          <SheetTitle>{t("clients.sheetNewTitle")}</SheetTitle>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("clients.sheetNewDescription")}
          </p>
        </SheetHeader>
        <form onSubmit={onSubmit} className="premium-scrollbar flex flex-1 flex-col overflow-y-auto">
          <div className="flex-1 space-y-4 px-6 py-5 pb-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="nc-first">{t("appointments.fieldClientFirstName")}</Label>
                <Input
                  id="nc-first"
                  required
                  className="h-11 touch-manipulation sm:h-10"
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="nc-last">{t("appointments.fieldClientLastName")}</Label>
                <Input
                  id="nc-last"
                  className="h-11 touch-manipulation sm:h-10"
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                />
              </div>
            </div>
            <InternationalPhoneFieldGroup
              label={`${t("clients.fieldPhoneShort")} *`}
              dialCode={form.phoneDialCode}
              nationalDigits={form.phoneNational}
              onDialCodeChange={(v) => setForm((f) => ({ ...f, phoneDialCode: v }))}
              onNationalChange={(digits) => setForm((f) => ({ ...f, phoneNational: digits }))}
              dialSelectId="nc-phone-dial"
              nationalInputId="nc-phone"
            />
            <div className="space-y-1">
              <Label htmlFor="nc-email">{t("clients.fieldEmailShort")}</Label>
              <Input
                id="nc-email"
                type="email"
                className="h-11 touch-manipulation sm:h-10"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="nc-notes">{t("clients.fieldNotesShort")}</Label>
              <Textarea
                id="nc-notes"
                className="min-h-24 touch-manipulation rounded-xl"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder={t("clients.notesPlaceholderUi")}
              />
            </div>
            {fieldError ? (
              <p className="text-sm text-destructive" role="alert">
                {fieldError}
              </p>
            ) : null}
          </div>
          <SheetFooter className="border-t border-border/70 px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
            <FormActions
              submitLabel={t("clients.saveClientSubmit")}
              isSubmitting={isSaving}
              submittingLabel={t("common.saving")}
              onCancel={() => onOpenChange(false)}
              cancelLabel={t("appointments.closeFormCancel")}
            />
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
