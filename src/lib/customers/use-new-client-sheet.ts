"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import type { NewClientFormState } from "@/components/customers/new-client-sheet"
import { persistNewClient } from "@/lib/clients/persist-new-client"
import { joinCustomerName } from "@/lib/customers/customer-name"
import { isEmailFormatValid } from "@/lib/clients/client-attachments"
import {
  buildStoredInternationalPhone,
  validateNationalPhoneLength,
} from "@/lib/validation/international-phone"

const EMPTY_FORM: NewClientFormState = {
  firstName: "",
  lastName: "",
  phoneDialCode: "+48",
  phoneNational: "",
  email: "",
  notes: "",
}

export function useNewClientSheet(businessId: string | null | undefined) {
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [form, setForm] = React.useState<NewClientFormState>(EMPTY_FORM)
  const [fieldError, setFieldError] = React.useState<string | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)

  const openCreate = React.useCallback(() => {
    setForm(EMPTY_FORM)
    setFieldError(null)
    setSheetOpen(true)
  }, [])

  const saveClient = React.useCallback(
    async (e: React.FormEvent, t: (key: string) => string) => {
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
      if (email && !isEmailFormatValid(email)) {
        setFieldError(t("clients.validationEmail"))
        return
      }

      setFieldError(null)
      setIsSaving(true)
      try {
        const res = await persistNewClient({
          businessProfileId: businessId ?? null,
          fullName,
          phone,
          email,
          notes: form.notes,
        })
        if (!res.ok) {
          setFieldError(t("clients.saveFailed"))
          return
        }
        setSheetOpen(false)
        router.push(`/klienci/${encodeURIComponent(res.clientId)}`)
      } finally {
        setIsSaving(false)
      }
    },
    [businessId, form, router],
  )

  return {
    sheetOpen,
    setSheetOpen,
    form,
    setForm,
    fieldError,
    isSaving,
    openCreate,
    saveClient,
  }
}
