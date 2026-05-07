import { dictionaries } from "@/lib/i18n/dictionaries"
import type { Language } from "@/lib/i18n/dictionaries"
import type { MessageTemplate } from "@/types/domain"

export function buildInitialMessageTemplates(
  lang: Language
): MessageTemplate[] {
  const lib = dictionaries[lang].templatesLibrary
  return [
    {
      id: "tpl-1",
      title: lib.tpl1Title,
      type: "reminder",
      channel: "sms",
      status: "active",
      body: lib.tpl1Body,
    },
    {
      id: "tpl-5",
      title: lib.tpl5Title,
      type: "second_reminder",
      channel: "sms",
      status: "active",
      body: lib.tpl5Body,
    },
    {
      id: "tpl-2",
      title: lib.tpl2Title,
      type: "confirmation",
      channel: "sms",
      status: "active",
      body: lib.tpl2Body,
    },
    {
      id: "tpl-4",
      title: lib.tpl4Title,
      type: "followup_noshow",
      channel: "sms",
      status: "draft",
      body: lib.tpl4Body,
    },
    {
      id: "tpl-6",
      title: lib.tpl6Title,
      type: "booking_cancelled_by_company",
      channel: "sms",
      status: "active",
      body: lib.tpl6Body,
    },
    {
      id: "tpl-7",
      title: lib.tpl7Title,
      type: "booking_cancelled_by_company",
      channel: "email",
      status: "active",
      body: lib.tpl7Body,
    },
  ]
}
