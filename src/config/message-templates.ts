import type {
  MessageTemplateChannel,
  MessageTemplateStatus,
  MessageTemplateType,
} from "@/types/domain"

export const templateTypeOrder: MessageTemplateType[] = [
  "reminder_24h",
  "reminder_before_visit",
  "booking_confirmation",
  "booking_cancelled_by_company",
  "no_show_follow_up",
  "reminder",
  "second_reminder",
  "confirmation",
  "followup_noshow",
]

export const templateChannelOrder: MessageTemplateChannel[] = ["sms", "email"]

export const templateStatusOrder: MessageTemplateStatus[] = ["active", "draft"]
