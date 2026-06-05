"use client"

import * as React from "react"
import { CheckCircle2, Download, FileSpreadsheet, FileText, Loader2, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useTranslations } from "@/lib/i18n/use-translations"
import { cn } from "@/lib/utils"

export type ExportFormatId = "csv" | "excel" | "pdf"

export type ExportFormatOption = {
  id: ExportFormatId
  label: string
  description?: string
}

type ExportPhase = "idle" | "loading" | "success" | "error"

export type ExportFormatSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  formats: ExportFormatOption[]
  rowCount?: number
  disabled?: boolean
  onExport: (format: ExportFormatId) => Promise<void>
}

export function ExportFormatSheet({
  open,
  onOpenChange,
  title,
  description,
  formats,
  rowCount,
  disabled = false,
  onExport,
}: ExportFormatSheetProps) {
  const { t } = useTranslations()
  const [phase, setPhase] = React.useState<ExportPhase>("idle")
  const [activeFormat, setActiveFormat] = React.useState<ExportFormatId | null>(null)

  React.useEffect(() => {
    if (!open) {
      setPhase("idle")
      setActiveFormat(null)
    }
  }, [open])

  const handleExport = async (format: ExportFormatId) => {
    setActiveFormat(format)
    setPhase("loading")
    try {
      await onExport(format)
      setPhase("success")
    } catch {
      setPhase("error")
    }
  }

  const formatIcon = (id: ExportFormatId) => {
    if (id === "pdf") return <FileText className="size-4" aria-hidden />
    if (id === "excel") return <FileSpreadsheet className="size-4" aria-hidden />
    return <Download className="size-4" aria-hidden />
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col border-border p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border/70 px-5 py-4 text-left">
          <SheetTitle>{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
          {typeof rowCount === "number" ? (
            <p className="text-xs text-muted-foreground">
              {t("exports.rowCount").replace("{count}", String(rowCount))}
            </p>
          ) : null}
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
          {formats.map((format) => (
            <Button
              key={format.id}
              type="button"
              variant="outline"
              className={cn(
                "h-auto min-h-12 justify-start gap-3 rounded-xl px-4 py-3 text-left",
                activeFormat === format.id && phase === "loading" && "pointer-events-none opacity-70",
              )}
              disabled={disabled || phase === "loading"}
              onClick={() => void handleExport(format.id)}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                {activeFormat === format.id && phase === "loading" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  formatIcon(format.id)
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{format.label}</span>
                {format.description ? (
                  <span className="block text-xs text-muted-foreground">{format.description}</span>
                ) : null}
              </span>
            </Button>
          ))}

          {phase === "success" ? (
            <p
              className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200"
              role="status"
            >
              <CheckCircle2 className="size-4 shrink-0" aria-hidden />
              {t("exports.success")}
            </p>
          ) : null}

          {phase === "error" ? (
            <p
              className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              <XCircle className="size-4 shrink-0" aria-hidden />
              {t("exports.error")}
            </p>
          ) : null}
        </div>

        <SheetFooter className="border-t border-border/70 px-5 py-4">
          <Button
            type="button"
            variant="ghost"
            className="w-full rounded-xl"
            onClick={() => onOpenChange(false)}
          >
            {t("exports.close")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
