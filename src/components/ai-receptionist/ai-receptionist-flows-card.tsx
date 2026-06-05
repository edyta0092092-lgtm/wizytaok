"use client"

import { GitBranch } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AI_RECEPTIONIST_FLOWS } from "@/lib/ai-receptionist/flows"
import { useTranslations } from "@/lib/i18n/use-translations"

export function AiReceptionistFlowsCard() {
  const { t } = useTranslations()

  return (
    <Card className="rounded-2xl border border-border shadow-sm">
      <CardHeader className="border-b border-border/70 py-4">
        <div className="flex items-center gap-2">
          <GitBranch className="size-4 text-violet-600" aria-hidden />
          <CardTitle className="text-sm font-semibold">
            {t("aiReceptionistPanel.flowsTitle")}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 pt-4 sm:grid-cols-2 lg:grid-cols-3">
        {AI_RECEPTIONIST_FLOWS.map((flow) => (
          <div
            key={flow.id}
            className="rounded-xl border border-border/60 bg-muted/15 px-3 py-3"
          >
            <p className="text-sm font-medium text-foreground">
              {t(`aiReceptionistPanel.${flow.titleKey}`)}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {t(`aiReceptionistPanel.${flow.descriptionKey}`)}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
