"use client"

import * as React from "react"
import { Megaphone, Plus } from "lucide-react"

import { MarketingCampaignForm } from "@/components/marketing/marketing-campaign-form"
import { MarketingCampaignList } from "@/components/marketing/marketing-campaign-list"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useBusinessAccess } from "@/lib/auth/business-access-context"
import { useMarketingWorkspace } from "@/lib/marketing/use-marketing-workspace"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { useTranslations } from "@/lib/i18n/use-translations"

export function MarketingPage() {
  const { t } = useTranslations()
  const { ready: accessReady, businessId, displayName } = useBusinessAccess()
  const { ready, campaigns, customerRows, countRecipients, saveDraft, deleteCampaign } =
    useMarketingWorkspace(accessReady ? businessId : undefined)

  const [businessName, setBusinessName] = React.useState("")
  const [showForm, setShowForm] = React.useState(false)

  React.useEffect(() => {
    if (!businessId || !isSupabaseConfigured()) {
      setBusinessName(displayName?.trim() || "")
      return
    }
    let cancelled = false
    const client = getBrowserClient()
    if (!client) return
    void (async () => {
      const { data } = await client
        .from("business_profiles")
        .select("business_name")
        .eq("id", businessId)
        .maybeSingle()
      if (!cancelled) {
        const name =
          typeof data?.business_name === "string" && data.business_name.trim()
            ? data.business_name.trim()
            : displayName?.trim() || t("marketingPanel.previewBusinessFallback")
        setBusinessName(name)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [businessId, displayName, t])

  const handleDelete = (id: string) => {
    if (!window.confirm(t("marketingPanel.deleteConfirm"))) return
    deleteCampaign(id)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Megaphone className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{t("marketingPanel.heading")}</h2>
            <p className="text-sm text-muted-foreground">{t("marketingPanel.lead")}</p>
          </div>
        </div>
        <Button
          type="button"
          className="h-10 rounded-xl"
          onClick={() => setShowForm((v) => !v)}
        >
          <Plus className="mr-1.5 size-4" aria-hidden />
          {showForm ? t("marketingPanel.hideForm") : t("marketingPanel.newCampaign")}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <HighlightCard label={t("marketingPanel.highlightDraft")} value={String(campaigns.length)} />
        <HighlightCard
          label={t("marketingPanel.highlightSms")}
          value={String(campaigns.filter((c) => c.channel === "sms").length)}
        />
        <HighlightCard
          label={t("marketingPanel.highlightEmail")}
          value={String(campaigns.filter((c) => c.channel === "email").length)}
        />
      </div>

      {!ready ? (
        <Card className="rounded-2xl border border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t("marketingPanel.loading")}
          </CardContent>
        </Card>
      ) : null}

      {ready && showForm ? (
        <MarketingCampaignForm
          customerRows={customerRows}
          businessName={businessName}
          countRecipients={countRecipients}
          onSaveDraft={(draft) => {
            saveDraft(draft)
            setShowForm(false)
          }}
        />
      ) : null}

      {ready ? (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">{t("marketingPanel.listTitle")}</h3>
          {campaigns.length === 0 ? (
            <Card className="rounded-2xl border border-dashed">
              <CardContent className="py-10 text-center">
                <p className="text-sm font-medium">{t("marketingPanel.emptyTitle")}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t("marketingPanel.emptyHint")}</p>
              </CardContent>
            </Card>
          ) : (
            <MarketingCampaignList campaigns={campaigns} onDelete={handleDelete} />
          )}
        </section>
      ) : null}
    </div>
  )
}

function HighlightCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="rounded-2xl border-border/60 shadow-sm">
      <CardContent className="px-4 py-4">
        <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  )
}
