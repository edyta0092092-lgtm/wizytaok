"use client"

import * as React from "react"

import { filterCustomersByMarketingSegment } from "@/lib/marketing/marketing-audience"
import {
  allocateMarketingCampaignId,
  readMarketingCampaigns,
  writeMarketingCampaigns,
} from "@/lib/marketing/marketing-campaign-storage"
import type {
  MarketingCampaign,
  MarketingCampaignDraft,
} from "@/lib/marketing/marketing-types"
import { useCustomersCrm } from "@/lib/customers/use-customers-crm"

export function useMarketingWorkspace(businessId: string | null | undefined) {
  const { ready: customersReady, rows: customerRows } = useCustomersCrm(businessId)
  const [campaigns, setCampaigns] = React.useState<MarketingCampaign[]>([])
  const [storageReady, setStorageReady] = React.useState(false)

  const reloadCampaigns = React.useCallback(() => {
    if (!businessId) {
      setCampaigns([])
      setStorageReady(true)
      return
    }
    setCampaigns(readMarketingCampaigns(businessId))
    setStorageReady(true)
  }, [businessId])

  React.useEffect(() => {
    queueMicrotask(() => reloadCampaigns())
  }, [reloadCampaigns])

  const persist = React.useCallback(
    (next: MarketingCampaign[]) => {
      if (!businessId) return
      setCampaigns(next)
      writeMarketingCampaigns(businessId, next)
    },
    [businessId],
  )

  const countRecipients = React.useCallback(
    (segment: MarketingCampaignDraft["audienceSegment"]) => {
      if (!customersReady) return 0
      return filterCustomersByMarketingSegment(customerRows, segment).length
    },
    [customerRows, customersReady],
  )

  const saveDraft = React.useCallback(
    (draft: MarketingCampaignDraft) => {
      if (!businessId) return null
      const recipientCount = countRecipients(draft.audienceSegment)
      const campaign: MarketingCampaign = {
        id: allocateMarketingCampaignId(),
        businessId,
        name: draft.name.trim(),
        channel: draft.channel,
        status: "draft",
        audienceSegment: draft.audienceSegment,
        messageBody: draft.messageBody.trim(),
        recipientCount,
        createdAt: new Date().toISOString(),
        sentAt: null,
      }
      const next = [campaign, ...campaigns]
      persist(next)
      return campaign
    },
    [businessId, campaigns, countRecipients, persist],
  )

  const deleteCampaign = React.useCallback(
    (id: string) => {
      persist(campaigns.filter((c) => c.id !== id))
    },
    [campaigns, persist],
  )

  return {
    ready: storageReady && customersReady,
    campaigns,
    customerRows,
    countRecipients,
    saveDraft,
    deleteCampaign,
    reloadCampaigns,
  }
}
