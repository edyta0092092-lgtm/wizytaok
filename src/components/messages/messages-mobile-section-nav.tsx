"use client"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTranslations } from "@/lib/i18n/use-translations"

export type MessagesMobileSection = "quota" | "templates" | "custom" | "history"

type MessagesMobileSectionNavProps = {
  value: MessagesMobileSection
  onChange: (value: MessagesMobileSection) => void
  showTemplates: boolean
}

export function MessagesMobileSectionNav({
  value,
  onChange,
  showTemplates,
}: MessagesMobileSectionNavProps) {
  const { t } = useTranslations()

  const options: Array<{ value: MessagesMobileSection; labelKey: string }> = [
    { value: "quota", labelKey: "messages.mobileSectionQuota" },
  ]
  if (showTemplates) {
    options.push(
      { value: "templates", labelKey: "messages.mobileSectionTemplates" },
      { value: "custom", labelKey: "messages.mobileSectionCustom" },
    )
  }
  options.push({ value: "history", labelKey: "messages.mobileSectionHistory" })

  return (
    <div className="lg:hidden">
      <Label htmlFor="messages-mobile-section" className="sr-only">
        {t("messages.mobileSectionLabel")}
      </Label>
      <Select value={value} onValueChange={(v) => onChange(v as MessagesMobileSection)}>
        <SelectTrigger id="messages-mobile-section" className="h-11 w-full touch-manipulation rounded-xl">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {t(option.labelKey)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
