/** Kanał kampanii marketingowej (MVP: tylko podgląd, bez masowej wysyłki). */
export type MarketingChannel = "sms" | "email"

export type MarketingCampaignStatus = "draft" | "sent"

/** Segmenty odbiorców kampanii. */
export type MarketingAudienceSegment =
  | "all"
  | "new"
  | "returning"
  | "inactive_30"
  | "inactive_60"
  | "cancelled_visit"
  | "no_show"

export type MarketingCampaign = {
  id: string
  businessId: string
  name: string
  channel: MarketingChannel
  status: MarketingCampaignStatus
  audienceSegment: MarketingAudienceSegment
  messageBody: string
  recipientCount: number
  createdAt: string
  sentAt: string | null
}

export type MarketingCampaignDraft = {
  name: string
  channel: MarketingChannel
  audienceSegment: MarketingAudienceSegment
  messageBody: string
}
