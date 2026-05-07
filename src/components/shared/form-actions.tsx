"use client"

import { Button } from "@/components/ui/button"

type FormActionsProps = {
  cancelLabel: string
  submitLabel: string
  onCancel?: () => void
  isSubmitting?: boolean
  submitDisabled?: boolean
  submittingLabel?: string
  submitType?: "button" | "submit"
  submitForm?: string
  align?: "end" | "between"
}

export function FormActions({
  cancelLabel,
  submitLabel,
  onCancel,
  isSubmitting = false,
  submitDisabled = false,
  submittingLabel,
  submitType = "submit",
  submitForm,
  align = "end",
}: FormActionsProps) {
  return (
    <div
      className={`flex w-full flex-col-reverse gap-3 sm:flex-row sm:items-center ${
        align === "between" ? "sm:justify-between" : "sm:justify-end"
      }`}
    >
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full rounded-xl border-border/80 sm:w-auto"
        onClick={onCancel}
        disabled={isSubmitting}
      >
        {cancelLabel}
      </Button>
      <Button
        type={submitType}
        form={submitForm}
        className="h-11 w-full rounded-xl sm:w-auto sm:min-w-[160px]"
        disabled={isSubmitting || submitDisabled}
      >
        {isSubmitting ? submittingLabel ?? submitLabel : submitLabel}
      </Button>
    </div>
  )
}
