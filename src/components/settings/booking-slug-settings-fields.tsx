"use client"

import * as React from "react"
import Link from "next/link"
import { Check, Copy, ExternalLink, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  bookingSlugPreviewSegment,
  businessBookingPagePath,
  businessBookingPageUrl,
  getBookingPageDisplayOrigin,
} from "@/lib/business/booking-page-path"
import { isValidPublicSlugFormat, normalizePublicSlug } from "@/lib/business/slug"
import { useTranslations } from "@/lib/i18n/use-translations"
import { cn } from "@/lib/utils"

type SlugAvailabilityState = "idle" | "checking" | "available" | "taken" | "invalid" | "error"

function sanitizeSlugInput(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9-]/g, "")
}

export function BookingSlugSettingsFields({
  value,
  savedSlug,
  onChange,
}: {
  value: string
  savedSlug: string
  onChange: (next: string) => void
}) {
  const { t } = useTranslations()
  const [availability, setAvailability] = React.useState<SlugAvailabilityState>("idle")
  const normalized = React.useMemo(() => normalizePublicSlug(value), [value])
  const previewSegment = bookingSlugPreviewSegment(value)
  const previewOrigin = getBookingPageDisplayOrigin()
  const previewPath = businessBookingPagePath(value)
  const fullUrl = businessBookingPageUrl(value)
  const canOpen = isValidPublicSlugFormat(normalized)
  const canCopy = canOpen

  React.useEffect(() => {
    if (!normalized) {
      setAvailability("idle")
      return
    }

    if (!isValidPublicSlugFormat(normalized)) {
      setAvailability("invalid")
      return
    }

    if (savedSlug && normalizePublicSlug(savedSlug) === normalized) {
      setAvailability("available")
      return
    }

    setAvailability("checking")
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(
            `/api/business/slug-availability?slug=${encodeURIComponent(normalized)}`,
            { cache: "no-store" },
          )
          const json = (await res.json()) as {
            ok?: boolean
            state?: "available" | "taken" | "invalid"
          }
          if (!json.ok) {
            setAvailability("error")
            return
          }
          if (json.state === "available") setAvailability("available")
          else if (json.state === "taken") setAvailability("taken")
          else setAvailability("invalid")
        } catch {
          setAvailability("error")
        }
      })()
    }, 400)

    return () => window.clearTimeout(timer)
  }, [normalized, savedSlug])

  const copyLink = async () => {
    if (!canCopy) return
    try {
      await navigator.clipboard.writeText(fullUrl)
      toast.success(t("settings.bookingSlugCopied"))
    } catch {
      toast.error(t("settings.bookingSlugCopyFailed"))
    }
  }

  return (
    <div className="space-y-4" data-tour="settings-booking-slug">
      <div className="space-y-1.5">
        <Label htmlFor="booking-slug">{t("settings.bookingSlugLabel")}</Label>
        <Input
          id="booking-slug"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(sanitizeSlugInput(e.target.value))}
          placeholder={t("settings.bookingSlugPlaceholder")}
          className="h-11 rounded-xl font-mono text-base sm:text-sm"
          aria-invalid={availability === "invalid" || availability === "taken"}
        />
        <p className="text-xs text-muted-foreground">{t("settings.bookingSlugHint")}</p>
        {availability === "invalid" ? (
          <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
            <X className="size-3.5 shrink-0" aria-hidden />
            {t("auth.slugInvalid")}
          </p>
        ) : null}
        {availability === "taken" ? (
          <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
            <X className="size-3.5 shrink-0" aria-hidden />
            {t("auth.slugTaken")}
          </p>
        ) : null}
        {availability === "available" && normalized ? (
          <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300">
            <Check className="size-3.5 shrink-0" aria-hidden />
            {t("settings.bookingSlugAvailable")}
          </p>
        ) : null}
        {availability === "checking" ? (
          <p className="text-xs text-muted-foreground">{t("settings.bookingSlugChecking")}</p>
        ) : null}
        {availability === "error" ? (
          <p className="text-xs text-amber-700 dark:text-amber-300">{t("auth.slugCheckError")}</p>
        ) : null}
      </div>

      <div className="rounded-xl border border-border/80 bg-muted/20 px-4 py-3">
        <p className="text-xs font-medium text-foreground">{t("settings.bookingSlugPreviewLabel")}</p>
        <p
          className={cn(
            "mt-1 break-all font-mono text-sm",
            canOpen ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {previewOrigin}/rezerwacje/{previewSegment}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 rounded-xl"
          disabled={!canCopy}
          onClick={() => void copyLink()}
        >
          <Copy className="mr-1.5 size-4" aria-hidden />
          {t("settings.bookingSlugCopyLink")}
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-10 rounded-xl" asChild disabled={!canOpen}>
          <Link href={previewPath} target="_blank" rel="noreferrer">
            <ExternalLink className="mr-1.5 size-4" aria-hidden />
            {t("settings.openBookingPage")}
          </Link>
        </Button>
      </div>
    </div>
  )
}
