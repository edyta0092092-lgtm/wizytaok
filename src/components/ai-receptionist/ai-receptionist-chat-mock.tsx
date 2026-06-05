"use client"

import { Bot, User } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { AiConversationPreview, AiReceptionistConfig } from "@/lib/ai-receptionist/types"
import { useTranslations } from "@/lib/i18n/use-translations"

export function AiReceptionistChatMock({
  conversation,
  config,
}: {
  conversation: AiConversationPreview
  config: AiReceptionistConfig
}) {
  const { t } = useTranslations()
  const assistantLabel = config.assistantName.trim() || t("aiReceptionistPanel.defaultAssistantName")

  return (
    <Card className="rounded-2xl border border-border shadow-sm">
      <CardHeader className="border-b border-border/70 py-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-semibold">
              {t("aiReceptionistPanel.chatTitle")}
            </CardTitle>
            <CardDescription className="mt-1 text-xs">
              {t("aiReceptionistPanel.chatDescription")}
            </CardDescription>
          </div>
          <Badge variant="outline" className="rounded-lg text-xs">
            {t("aiReceptionistPanel.chatMockBadge")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        <p className="text-xs font-medium text-muted-foreground">{conversation.title}</p>
        <div
          className="max-h-[420px] space-y-3 overflow-y-auto rounded-xl border border-border/80 bg-muted/15 p-4"
          role="log"
          aria-label={t("aiReceptionistPanel.chatTitle")}
        >
          {conversation.messages.map((msg) => {
            const isClient = msg.role === "client"
            return (
              <div
                key={msg.id}
                className={`flex gap-2 ${isClient ? "justify-start" : "justify-end"}`}
              >
                {isClient ? (
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <User className="size-3.5" aria-hidden />
                  </span>
                ) : null}
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    isClient
                      ? "rounded-tl-sm bg-background border border-border/80 text-foreground"
                      : "rounded-tr-sm bg-violet-600 text-white"
                  }`}
                >
                  {!isClient ? (
                    <p className="mb-1 text-[0.625rem] font-medium uppercase tracking-wide text-violet-100">
                      {assistantLabel}
                    </p>
                  ) : (
                    <p className="mb-1 text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground">
                      {t("aiReceptionistPanel.chatClientLabel")}
                    </p>
                  )}
                  <p>{msg.content}</p>
                </div>
                {!isClient ? (
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-violet-600">
                    <Bot className="size-3.5" aria-hidden />
                  </span>
                ) : null}
              </div>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground">{t("aiReceptionistPanel.chatInputDisabled")}</p>
      </CardContent>
    </Card>
  )
}
